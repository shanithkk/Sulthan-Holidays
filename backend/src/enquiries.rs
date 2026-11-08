//! Enquiries: anyone can send one; staff follow them up.
use crate::{audit::audit, auth::*, config::AppState, error::*, ratelimit::ClientIp};
use axum::{
    Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct EnquiryIn {
    name: String,
    phone: String,
    email: Option<String>,
    package_id: Option<Uuid>,
    vehicle_id: Option<Uuid>,
    travel_date: Option<NaiveDate>,
    #[serde(default = "one")]
    people: i32,
    message: Option<String>,
}

fn one() -> i32 {
    1
}

pub async fn create(
    State(s): State<AppState>,
    MaybeCustomer(user_id): MaybeCustomer,
    ClientIp(ip): ClientIp,
    Json(b): Json<EnquiryIn>,
) -> AppResult<Json<Value>> {
    // Public form: stop one address from flooding the inbox.
    s.limiter.check(
        &format!("enquiry:{ip}"),
        10,
        std::time::Duration::from_secs(3600),
    )?;
    let name = require_text(&b.name, "Name", 100)?;
    let phone = normalize_phone(&b.phone)?;
    let email = b
        .email
        .as_deref()
        .filter(|e| !e.trim().is_empty())
        .map(normalize_email)
        .transpose()?;
    if !(1..=100).contains(&b.people) {
        return bad("Number of people must be between 1 and 100");
    }
    if b.message
        .as_deref()
        .is_some_and(|m| m.chars().count() > 2000)
    {
        return bad("Message is too long");
    }
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO enquiries (user_id, name, phone, email, package_id, vehicle_id, travel_date, people, message) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
    )
    .bind(user_id).bind(name).bind(phone).bind(email).bind(b.package_id).bind(b.vehicle_id)
    .bind(b.travel_date).bind(b.people).bind(b.message.as_deref().map(str::trim))
    .fetch_one(&s.db)
    .await?;
    Ok(Json(
        json!({ "id": id, "message": "Thanks! Our team will contact you shortly." }),
    ))
}

#[derive(sqlx::FromRow, Serialize)]
pub struct EnquiryRow {
    id: Uuid,
    name: String,
    phone: String,
    email: Option<String>,
    people: i32,
    travel_date: Option<NaiveDate>,
    message: Option<String>,
    status: String,
    subject: Option<String>,
    created_at: DateTime<Utc>,
}

pub async fn list_admin(
    State(s): State<AppState>,
    _: StaffAuth,
) -> AppResult<Json<Vec<EnquiryRow>>> {
    Ok(Json(
        sqlx::query_as(
            "SELECT e.id, e.name, e.phone, e.email, e.people, e.travel_date, e.message, e.status, \
             COALESCE(p.title, v.name) AS subject, e.created_at \
             FROM enquiries e LEFT JOIN packages p ON p.id = e.package_id LEFT JOIN vehicles v ON v.id = e.vehicle_id \
             ORDER BY e.created_at DESC LIMIT 500",
        )
        .fetch_all(&s.db)
        .await?,
    ))
}

#[derive(Deserialize)]
pub struct StatusIn {
    status: String,
}

pub async fn set_status(
    State(s): State<AppState>,
    staff: StaffAuth,
    Path(id): Path<Uuid>,
    Json(b): Json<StatusIn>,
) -> AppResult<Json<Value>> {
    if !["new", "contacted", "converted", "closed"].contains(&b.status.as_str()) {
        return bad("Invalid status");
    }
    let n = sqlx::query("UPDATE enquiries SET status = $1 WHERE id = $2")
        .bind(&b.status)
        .bind(id)
        .execute(&s.db)
        .await?;
    if n.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    audit(
        &s.db,
        staff.id,
        "set_status",
        "enquiry",
        Some(id),
        json!({ "status": b.status }),
    )
    .await;
    Ok(Json(json!({ "ok": true })))
}
