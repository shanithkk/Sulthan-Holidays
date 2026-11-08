use crate::{auth::StaffAuth, config::AppState, error::AppResult};
use axum::{Json, extract::State};
use serde::Serialize;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

/// Record an admin action. Failures are logged but never block the action itself.
pub async fn audit(db: &PgPool, staff_id: Uuid, action: &str, entity: &str, entity_id: Option<Uuid>, details: Value) {
    let r = sqlx::query("INSERT INTO audit_logs (staff_id, action, entity, entity_id, details) VALUES ($1,$2,$3,$4,$5)")
        .bind(staff_id)
        .bind(action)
        .bind(entity)
        .bind(entity_id)
        .bind(details)
        .execute(db)
        .await;
    if let Err(e) = r {
        tracing::error!("audit log failed: {e}");
    }
}

#[derive(sqlx::FromRow, Serialize)]
pub struct AuditRow {
    id: Uuid,
    staff_name: Option<String>,
    action: String,
    entity: String,
    entity_id: Option<Uuid>,
    details: Value,
    created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn list(State(s): State<AppState>, _: StaffAuth) -> AppResult<Json<Vec<AuditRow>>> {
    Ok(Json(
        sqlx::query_as(
            "SELECT a.id, st.name AS staff_name, a.action, a.entity, a.entity_id, a.details, a.created_at \
             FROM audit_logs a LEFT JOIN staff st ON st.id = a.staff_id ORDER BY a.created_at DESC LIMIT 200",
        )
        .fetch_all(&s.db)
        .await?,
    ))
}
