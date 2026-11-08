//! Admin: dashboard stats and booking management (confirm, cancel, mark paid, refund).
use crate::{
    audit::audit,
    auth::*,
    bookings::{BookingView, VIEW_SQL, fetch_view},
    config::AppState,
    error::*,
};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

#[derive(sqlx::FromRow, Serialize)]
pub struct Stats {
    new_enquiries: i64,
    pending_bookings: i64,
    confirmed_bookings: i64,
    awaiting_payment_check: i64,
    revenue_paid: i64,
    active_packages: i64,
    active_vehicles: i64,
}

pub async fn stats(State(s): State<AppState>, _: StaffAuth) -> AppResult<Json<Stats>> {
    Ok(Json(
        sqlx::query_as(
            "SELECT \
             (SELECT COUNT(*) FROM enquiries WHERE status = 'new') AS new_enquiries, \
             (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pending_bookings, \
             (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') AS confirmed_bookings, \
             (SELECT COUNT(*) FROM bookings WHERE payment_status = 'submitted') AS awaiting_payment_check, \
             (SELECT COALESCE(SUM(advance_amount), 0)::BIGINT FROM bookings WHERE payment_status = 'paid') AS revenue_paid, \
             (SELECT COUNT(*) FROM packages WHERE active) AS active_packages, \
             (SELECT COUNT(*) FROM vehicles WHERE active) AS active_vehicles",
        )
        .fetch_one(&s.db)
        .await?,
    ))
}

pub async fn list_bookings(
    State(s): State<AppState>,
    _: StaffAuth,
) -> AppResult<Json<Vec<BookingView>>> {
    Ok(Json(
        query_as(&format!("{VIEW_SQL} ORDER BY b.created_at DESC LIMIT 500"))
            .fetch_all(&s.db)
            .await?,
    ))
}

/// Lock the booking row until the transaction ends, so two staff clicking at once (or a double
/// click) cannot both pass the status check and, say, refund the same booking twice.
async fn lock_booking(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, id: Uuid) -> AppResult<()> {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM bookings WHERE id = $1 FOR UPDATE")
        .bind(id)
        .fetch_one(&mut **tx)
        .await?;
    Ok(())
}

#[derive(Deserialize)]
pub struct StatusIn {
    status: String,
    /// Advance the customer must pay (rupees). Only used when confirming; defaults to ADVANCE_PERCENT.
    advance_amount: Option<i64>,
}

/// Advance = `percent`% of `amount`, rounded up, never below 1 or above the total.
pub fn default_advance(amount: i64, percent: i64) -> i64 {
    ((amount * percent + 99) / 100).clamp(1, amount.max(1))
}

pub async fn set_status(
    State(s): State<AppState>,
    staff: StaffAuth,
    Path(id): Path<Uuid>,
    Json(b): Json<StatusIn>,
) -> AppResult<Json<BookingView>> {
    if !["confirmed", "cancelled"].contains(&b.status.as_str()) {
        return bad("Status must be confirmed or cancelled");
    }
    let mut tx = s.db.begin().await?;
    lock_booking(&mut tx, id).await?;
    let cur = fetch_view(&s, id).await?;
    if cur.status == "cancelled" {
        return bad("A cancelled booking cannot be changed");
    }
    let mut advance = None;
    if b.status == "confirmed" {
        if cur.status != "pending" {
            return bad("This booking is already confirmed");
        }
        let a = b
            .advance_amount
            .unwrap_or_else(|| default_advance(cur.amount, s.cfg.advance_percent));
        // 0 = confirmed with no advance (trust-building: customer pays nothing online).
        if a < 0 || a > cur.amount {
            return bad("Advance must be between 0 and the booking amount");
        }
        advance = Some(a);
    }
    sqlx::query("UPDATE bookings SET status = $1, advance_amount = COALESCE($2, advance_amount) WHERE id = $3")
        .bind(&b.status)
        .bind(advance)
        .bind(id)
        .execute(&mut *tx)
        .await?;
    if let Some(a) = advance.filter(|a| *a > 0) {
        // The customer can pay only now: one payment row for the advance.
        sqlx::query("INSERT INTO payments (booking_id, method, amount) VALUES ($1, 'upi_qr', $2)")
            .bind(id)
            .bind(a)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    audit(
        &s.db,
        staff.id,
        &b.status,
        "booking",
        Some(id),
        json!({ "reference": cur.reference, "advance_amount": advance }),
    )
    .await;
    Ok(Json(fetch_view(&s, id).await?))
}

#[cfg(test)]
mod tests {
    use super::default_advance;

    #[test]
    fn advance_rounds_up_and_stays_in_range() {
        assert_eq!(default_advance(13_500, 25), 3_375);
        assert_eq!(default_advance(1_001, 25), 251);
        assert_eq!(default_advance(1, 25), 1);
        assert_eq!(default_advance(500, 100), 500);
    }
}

#[derive(Deserialize)]
pub struct AdvanceIn {
    /// 0 removes the advance; 1..=total asks for (or changes) it.
    amount: i64,
}

/// Change the advance on a confirmed booking that has not been paid: ask for one, change it, or remove it.
pub async fn set_advance(
    State(s): State<AppState>,
    staff: StaffAuth,
    Path(id): Path<Uuid>,
    Json(b): Json<AdvanceIn>,
) -> AppResult<Json<BookingView>> {
    let mut tx = s.db.begin().await?;
    lock_booking(&mut tx, id).await?;
    let cur = fetch_view(&s, id).await?;
    if cur.status != "confirmed" {
        return bad("Only confirmed bookings can have their advance changed");
    }
    if cur.payment_status == "paid" || cur.payment_status == "refunded" {
        return bad("The advance is already paid; use Refund instead");
    }
    if b.amount < 0 || b.amount > cur.amount {
        return bad("Advance must be between 0 and the booking amount");
    }
    // Drop any unpaid payment attempt, then start fresh if an advance is wanted.
    sqlx::query("DELETE FROM payments WHERE booking_id = $1 AND status IN ('pending','submitted')")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    if b.amount > 0 {
        sqlx::query("INSERT INTO payments (booking_id, method, amount) VALUES ($1, 'upi_qr', $2)")
            .bind(id)
            .bind(b.amount)
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query("UPDATE bookings SET advance_amount = $1, payment_status = 'unpaid' WHERE id = $2")
        .bind(b.amount)
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    audit(
        &s.db,
        staff.id,
        if b.amount == 0 {
            "remove_advance"
        } else {
            "set_advance"
        },
        "booking",
        Some(id),
        json!({ "reference": cur.reference, "from": cur.advance_amount, "to": b.amount }),
    )
    .await;
    Ok(Json(fetch_view(&s, id).await?))
}

/// Staff checked the money arrived in the UPI account.
pub async fn mark_paid(
    State(s): State<AppState>,
    staff: StaffAuth,
    Path(id): Path<Uuid>,
) -> AppResult<Json<BookingView>> {
    let mut tx = s.db.begin().await?;
    lock_booking(&mut tx, id).await?;
    let cur = fetch_view(&s, id).await?;
    if cur.status != "confirmed" {
        return bad("Confirm the booking (and set the advance) before recording payment");
    }
    if cur.payment_status == "paid" || cur.payment_status == "refunded" {
        return bad("Payment is already recorded");
    }
    if cur.advance_amount == Some(0) {
        return bad("No advance is asked for this booking");
    }
    sqlx::query("UPDATE payments SET status = 'paid', paid_at = now() WHERE booking_id = $1 AND status IN ('pending','submitted')")
        .bind(id).execute(&mut *tx).await?;
    sqlx::query("UPDATE bookings SET payment_status = 'paid' WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    audit(
        &s.db,
        staff.id,
        "mark_paid",
        "booking",
        Some(id),
        json!({ "reference": cur.reference, "advance_amount": cur.advance_amount, "total": cur.amount }),
    )
    .await;
    Ok(Json(fetch_view(&s, id).await?))
}

#[derive(Deserialize)]
pub struct RefundIn {
    amount: i64,
    reason: String,
}

/// Records a refund (money is returned manually by UPI for now) and cancels the booking.
pub async fn refund(
    State(s): State<AppState>,
    AdminAuth(staff): AdminAuth,
    Path(id): Path<Uuid>,
    Json(b): Json<RefundIn>,
) -> AppResult<Json<BookingView>> {
    let reason = require_text(&b.reason, "Reason", 500)?;
    let mut tx = s.db.begin().await?;
    lock_booking(&mut tx, id).await?;
    let cur = fetch_view(&s, id).await?;
    if cur.payment_status != "paid" {
        return bad("Only paid bookings can be refunded");
    }
    // Only the advance was collected online, so that is the most that can be refunded.
    let paid = cur.advance_amount.unwrap_or(cur.amount);
    if b.amount < 1 || b.amount > paid {
        return bad("Refund must be between 1 and the amount paid");
    }
    let payment_id: Uuid = sqlx::query_scalar("SELECT id FROM payments WHERE booking_id = $1 AND status = 'paid' ORDER BY created_at DESC LIMIT 1")
        .bind(id).fetch_one(&mut *tx).await?;
    sqlx::query(
        "INSERT INTO refunds (payment_id, amount, reason, created_by) VALUES ($1,$2,$3,$4)",
    )
    .bind(payment_id)
    .bind(b.amount)
    .bind(&reason)
    .bind(staff.id)
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE payments SET status = 'refunded' WHERE id = $1")
        .bind(payment_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "UPDATE bookings SET payment_status = 'refunded', status = 'cancelled' WHERE id = $1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    audit(
        &s.db,
        staff.id,
        "refund",
        "booking",
        Some(id),
        json!({ "reference": cur.reference, "amount": b.amount, "reason": reason }),
    )
    .await;
    Ok(Json(fetch_view(&s, id).await?))
}
