//! Customer bookings and the UPI-QR payment info.
//! Prices are always computed on the server, never trusted from the client.
use crate::{
    auth::*,
    config::AppState,
    error::*,
    packages::{compute_package_quote, fetch_package, package_seats},
    vehicles::{compute_fare, fetch_vehicle},
};
use axum::{
    Json,
    extract::{Path, State},
};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

#[derive(sqlx::FromRow, Serialize)]
pub struct BookingView {
    pub id: Uuid,
    pub reference: String,
    pub kind: String,
    pub title: Option<String>,
    pub travel_date: NaiveDate,
    pub end_date: NaiveDate,
    pub people: i32,
    pub km: Option<i32>,
    pub amount: i64,
    pub status: String,
    pub payment_status: String,
    pub notes: Option<String>,
    pub customer_name: String,
    pub customer_email: String,
    pub customer_phone: Option<String>,
    pub created_at: DateTime<Utc>,
    pub payment_reference: Option<String>,
    /// Advance the customer must pay once confirmed. `None` until staff confirm.
    pub advance_amount: Option<i64>,
    pub hotel: bool,
    pub pickup: bool,
    pub pickup_location: Option<String>,
    /// How the amount was built (cars, rooms, pickup...), frozen at booking time.
    pub price_breakdown: Option<Value>,
}

pub const VIEW_SQL: &str = "SELECT b.id, b.reference, b.kind, COALESCE(p.title, v.name) AS title, b.travel_date, \
    b.end_date, b.people, b.km, b.amount, b.status, b.payment_status, b.notes, u.name AS customer_name, \
    u.email AS customer_email, u.phone AS customer_phone, b.created_at, \
    (SELECT customer_reference FROM payments WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) AS payment_reference, \
    b.advance_amount, b.hotel, b.pickup, b.pickup_location, b.price_breakdown \
    FROM bookings b JOIN users u ON u.id = b.user_id \
    LEFT JOIN packages p ON p.id = b.package_id LEFT JOIN vehicles v ON v.id = b.vehicle_id";

#[derive(Deserialize)]
pub struct BookingIn {
    kind: String,
    package_id: Option<Uuid>,
    vehicle_id: Option<Uuid>,
    travel_date: NaiveDate,
    #[serde(default = "one")]
    days: i32,
    #[serde(default = "one")]
    people: i32,
    #[serde(default)]
    km: i32,
    #[serde(default)]
    night: bool,
    /// Package only: add a hotel stay.
    #[serde(default)]
    hotel: bool,
    /// Package only: pick the group up from `pickup_location`.
    #[serde(default)]
    pickup: bool,
    pickup_location: Option<String>,
    notes: Option<String>,
}

fn one() -> i32 {
    1
}

fn today_ist() -> NaiveDate {
    (Utc::now() + Duration::minutes(330)).date_naive()
}

fn new_reference() -> String {
    format!(
        "SH-{}",
        &Uuid::new_v4().simple().to_string()[..8].to_uppercase()
    )
}

pub async fn create(
    State(s): State<AppState>,
    CustomerAuth(uid): CustomerAuth,
    Json(b): Json<BookingIn>,
) -> AppResult<Json<BookingView>> {
    let phone: Option<String> = sqlx::query_scalar("SELECT phone FROM users WHERE id = $1")
        .bind(uid)
        .fetch_one(&s.db)
        .await?;
    if phone.is_none() {
        return bad("Please add your mobile number before booking");
    }
    if b.travel_date < today_ist() {
        return bad("Travel date cannot be in the past");
    }
    if !(1..=100).contains(&b.people) {
        return bad("Number of people must be between 1 and 100");
    }
    if b.notes.as_deref().is_some_and(|n| n.chars().count() > 1000) {
        return bad("Notes are too long");
    }
    let pickup_location = b
        .pickup_location
        .as_deref()
        .map(str::trim)
        .filter(|l| !l.is_empty());
    if pickup_location.is_some_and(|l| l.chars().count() > 200) {
        return bad("Pickup location is too long");
    }
    // (package_id, vehicle_id, amount, km, end_date, price breakdown)
    let (package_id, vehicle_id, amount, km, end_date, breakdown) = match b.kind.as_str() {
        "package" => {
            let p = fetch_package(&s.db, b.package_id.ok_or(AppError::NotFound)?).await?;
            if !p.active {
                return Err(AppError::NotFound);
            }
            if b.pickup && pickup_location.is_none() {
                return bad("Please enter the pickup location");
            }
            let seats = package_seats(&s.db, &p).await?;
            let quote = compute_package_quote(&p, seats, b.people, b.hotel, b.pickup)?;
            let end = b.travel_date + Duration::days(p.duration_days as i64 - 1);
            (
                Some(p.id),
                None,
                quote.total,
                None,
                end,
                serde_json::to_value(&quote).ok(),
            )
        }
        "vehicle" => {
            let v = fetch_vehicle(&s.db, b.vehicle_id.ok_or(AppError::NotFound)?).await?;
            if !v.active {
                return Err(AppError::NotFound);
            }
            if b.people > v.seats {
                return bad("This vehicle does not have enough seats");
            }
            let fare = compute_fare(&v, b.days, b.km, b.night)?;
            let end = b.travel_date + Duration::days(b.days as i64 - 1);
            (
                None,
                Some(v.id),
                fare.total,
                Some(b.km),
                end,
                serde_json::to_value(&fare).ok(),
            )
        }
        _ => return bad("Booking kind must be package or vehicle"),
    };
    let is_package = b.kind == "package";

    let mut tx = s.db.begin().await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO bookings (reference, user_id, kind, package_id, vehicle_id, travel_date, end_date, people, km, amount, notes, \
         hotel, pickup, pickup_location, price_breakdown) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id",
    )
    .bind(new_reference()).bind(uid).bind(&b.kind).bind(package_id).bind(vehicle_id).bind(b.travel_date)
    .bind(end_date).bind(b.people).bind(km).bind(amount).bind(b.notes.as_deref().map(str::trim))
    .bind(is_package && b.hotel).bind(is_package && b.pickup)
    .bind(if is_package && b.pickup { pickup_location } else { None })
    .bind(breakdown)
    .fetch_one(&mut *tx)
    .await?;
    // No payment yet: staff confirm first and set the advance (see admin::set_status).
    tx.commit().await?;
    Ok(Json(fetch_view(&s, id).await?))
}

pub async fn fetch_view(s: &AppState, id: Uuid) -> AppResult<BookingView> {
    Ok(query_as(&format!("{VIEW_SQL} WHERE b.id = $1"))
        .bind(id)
        .fetch_one(&s.db)
        .await?)
}

pub async fn list_mine(
    State(s): State<AppState>,
    CustomerAuth(uid): CustomerAuth,
) -> AppResult<Json<Vec<BookingView>>> {
    Ok(Json(
        query_as(&format!(
            "{VIEW_SQL} WHERE b.user_id = $1 ORDER BY b.created_at DESC"
        ))
        .bind(uid)
        .fetch_all(&s.db)
        .await?,
    ))
}

async fn owned(s: &AppState, uid: Uuid, id: Uuid) -> AppResult<BookingView> {
    let owner: Uuid = sqlx::query_scalar("SELECT user_id FROM bookings WHERE id = $1")
        .bind(id)
        .fetch_one(&s.db)
        .await?;
    if owner != uid {
        return Err(AppError::NotFound);
    }
    fetch_view(s, id).await
}

pub async fn get_mine(
    State(s): State<AppState>,
    CustomerAuth(uid): CustomerAuth,
    Path(id): Path<Uuid>,
) -> AppResult<Json<BookingView>> {
    Ok(Json(owned(&s, uid, id).await?))
}

fn enc(v: &str) -> String {
    v.bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) {
                (b as char).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect()
}

pub async fn payment_info(
    State(s): State<AppState>,
    CustomerAuth(uid): CustomerAuth,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let b = owned(&s, uid, id).await?;
    let advance = match (b.status.as_str(), b.advance_amount) {
        ("confirmed", Some(0)) => return bad("No advance is needed for this booking"),
        ("confirmed", Some(a)) => a,
        ("cancelled", _) => return bad("This booking is cancelled"),
        _ => return bad("Payment opens after our team confirms your booking"),
    };
    let upi_url = s.cfg.upi_id.as_ref().map(|upi| {
        format!(
            "upi://pay?pa={}&pn={}&am={}&cu=INR&tn={}",
            enc(upi),
            enc(&s.cfg.upi_payee),
            advance,
            enc(&b.reference)
        )
    });
    Ok(Json(json!({
        "reference": b.reference, "amount": advance, "total": b.amount, "balance": b.amount - advance,
        "payment_status": b.payment_status, "status": b.status,
        "payee": s.cfg.upi_payee, "upi_id": s.cfg.upi_id, "upi_url": upi_url,
    })))
}

#[derive(Deserialize)]
pub struct RefIn {
    reference: String,
}

/// Customer types the UPI transaction id after paying; staff then verify and mark paid.
pub async fn submit_reference(
    State(s): State<AppState>,
    CustomerAuth(uid): CustomerAuth,
    Path(id): Path<Uuid>,
    Json(b): Json<RefIn>,
) -> AppResult<Json<Value>> {
    let booking = owned(&s, uid, id).await?;
    if booking.payment_status != "unpaid" && booking.payment_status != "submitted" {
        return bad("Payment is already recorded");
    }
    if booking.status != "confirmed" {
        return bad("Payment opens after our team confirms your booking");
    }
    if booking.advance_amount.unwrap_or(0) == 0 {
        return bad("No advance is needed for this booking");
    }
    let r = require_text(&b.reference, "Transaction id", 60)?;
    let mut tx = s.db.begin().await?;
    sqlx::query("UPDATE payments SET customer_reference = $1, status = 'submitted' WHERE booking_id = $2 AND status IN ('pending','submitted')")
        .bind(r).bind(id).execute(&mut *tx).await?;
    sqlx::query("UPDATE bookings SET payment_status = 'submitted' WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(json!({ "ok": true })))
}
