//! "Our travellers": past trips with photos and feedback. Public read, staff edit.
use crate::{audit::audit, auth::*, config::AppState, error::*, places::safe_url};
use axum::{
    Json,
    extract::{Path, State},
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(sqlx::FromRow, Serialize)]
struct TripRow {
    id: Uuid,
    title: String,
    label: String,
    description: String,
    trip_date: Option<NaiveDate>,
    sort_order: i32,
    active: bool,
}

#[derive(sqlx::FromRow)]
struct PhotoRow {
    trip_id: Uuid,
    url: String,
    caption: Option<String>,
}

#[derive(sqlx::FromRow)]
struct FeedbackRow {
    trip_id: Uuid,
    author: Option<String>,
    body: String,
    rating: Option<i32>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TripPhoto {
    url: String,
    caption: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Feedback {
    author: Option<String>,
    body: String,
    rating: Option<i32>,
}

#[derive(Serialize)]
pub struct Trip {
    #[serde(flatten)]
    row: TripRow,
    photos: Vec<TripPhoto>,
    feedback: Vec<Feedback>,
}

async fn load(db: &PgPool, only_active: bool) -> AppResult<Vec<Trip>> {
    let sql = if only_active {
        "SELECT id, title, label, description, trip_date, sort_order, active FROM trips WHERE active ORDER BY sort_order, created_at DESC"
    } else {
        "SELECT id, title, label, description, trip_date, sort_order, active FROM trips ORDER BY sort_order, created_at DESC"
    };
    let rows: Vec<TripRow> = sqlx::query_as(sql).fetch_all(db).await?;
    let photos: Vec<PhotoRow> =
        sqlx::query_as("SELECT trip_id, url, caption FROM trip_photos ORDER BY trip_id, sort_order")
            .fetch_all(db)
            .await?;
    let fb: Vec<FeedbackRow> = sqlx::query_as(
        "SELECT trip_id, author, body, rating FROM trip_feedback ORDER BY trip_id, sort_order",
    )
    .fetch_all(db)
    .await?;
    let mut ph: HashMap<Uuid, Vec<TripPhoto>> = HashMap::new();
    for p in photos {
        ph.entry(p.trip_id).or_default().push(TripPhoto { url: p.url, caption: p.caption });
    }
    let mut fbs: HashMap<Uuid, Vec<Feedback>> = HashMap::new();
    for f in fb {
        fbs.entry(f.trip_id).or_default().push(Feedback { author: f.author, body: f.body, rating: f.rating });
    }
    Ok(rows
        .into_iter()
        .map(|row| Trip {
            photos: ph.remove(&row.id).unwrap_or_default(),
            feedback: fbs.remove(&row.id).unwrap_or_default(),
            row,
        })
        .collect())
}

pub async fn list_public(State(s): State<AppState>) -> AppResult<Json<Vec<Trip>>> {
    let mut v = load(&s.db, true).await?;
    v.retain(|t| !t.photos.is_empty()); // a trip with no photo has nothing to show
    Ok(Json(v))
}

pub async fn list_admin(State(s): State<AppState>, _: StaffAuth) -> AppResult<Json<Vec<Trip>>> {
    Ok(Json(load(&s.db, false).await?))
}

#[derive(Deserialize)]
pub struct TripIn {
    title: String,
    #[serde(default)]
    label: String,
    #[serde(default)]
    description: String,
    trip_date: Option<NaiveDate>,
    #[serde(default)]
    sort_order: i32,
    active: bool,
    #[serde(default)]
    photos: Vec<TripPhoto>,
    #[serde(default)]
    feedback: Vec<Feedback>,
}

fn validate(b: &TripIn) -> AppResult<()> {
    require_text(&b.title, "Title", 120)?;
    if b.label.chars().count() > 40 {
        return bad("Label is too long (max 40 characters), e.g. \"3 Day Trip\"");
    }
    if b.description.chars().count() > 1000 {
        return bad("Description is too long (max 1000 characters)");
    }
    if b.photos.len() > 30 || b.feedback.len() > 20 {
        return bad("At most 30 photos and 20 feedback notes per trip");
    }
    if b.photos.iter().any(|p| !safe_url(&p.url)) {
        return bad("Each photo needs an uploaded file or an https:// image link");
    }
    for f in &b.feedback {
        require_text(&f.body, "Feedback text", 1000)?;
        if f.author.as_deref().is_some_and(|a| a.chars().count() > 80) {
            return bad("Feedback name is too long (max 80 characters)");
        }
        if f.rating.is_some_and(|r| !(1..=5).contains(&r)) {
            return bad("Rating must be between 1 and 5");
        }
    }
    Ok(())
}

fn blank(o: &Option<String>) -> Option<String> {
    o.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(String::from)
}

async fn save_children(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, id: Uuid, b: &TripIn) -> AppResult<()> {
    sqlx::query("DELETE FROM trip_photos WHERE trip_id = $1").bind(id).execute(&mut **tx).await?;
    sqlx::query("DELETE FROM trip_feedback WHERE trip_id = $1").bind(id).execute(&mut **tx).await?;
    for (i, p) in b.photos.iter().enumerate() {
        sqlx::query("INSERT INTO trip_photos (trip_id, url, caption, sort_order) VALUES ($1,$2,$3,$4)")
            .bind(id).bind(&p.url).bind(blank(&p.caption)).bind(i as i32)
            .execute(&mut **tx)
            .await?;
    }
    for (i, f) in b.feedback.iter().enumerate() {
        sqlx::query("INSERT INTO trip_feedback (trip_id, author, body, rating, sort_order) VALUES ($1,$2,$3,$4,$5)")
            .bind(id).bind(blank(&f.author)).bind(f.body.trim()).bind(f.rating).bind(i as i32)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

pub async fn create(State(s): State<AppState>, staff: StaffAuth, Json(b): Json<TripIn>) -> AppResult<Json<Value>> {
    validate(&b)?;
    let mut tx = s.db.begin().await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO trips (title, label, description, trip_date, sort_order, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    )
    .bind(b.title.trim()).bind(b.label.trim()).bind(b.description.trim()).bind(b.trip_date)
    .bind(b.sort_order).bind(b.active)
    .fetch_one(&mut *tx)
    .await?;
    save_children(&mut tx, id, &b).await?;
    tx.commit().await?;
    audit(&s.db, staff.id, "create", "trip", Some(id), json!({ "title": b.title })).await;
    Ok(Json(json!({ "id": id })))
}

pub async fn update(
    State(s): State<AppState>,
    staff: StaffAuth,
    Path(id): Path<Uuid>,
    Json(b): Json<TripIn>,
) -> AppResult<Json<Value>> {
    validate(&b)?;
    let mut tx = s.db.begin().await?;
    let n = sqlx::query(
        "UPDATE trips SET title=$1, label=$2, description=$3, trip_date=$4, sort_order=$5, active=$6 WHERE id=$7",
    )
    .bind(b.title.trim()).bind(b.label.trim()).bind(b.description.trim()).bind(b.trip_date)
    .bind(b.sort_order).bind(b.active).bind(id)
    .execute(&mut *tx)
    .await?;
    if n.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    save_children(&mut tx, id, &b).await?;
    tx.commit().await?;
    audit(&s.db, staff.id, "update", "trip", Some(id), json!({ "title": b.title, "photos": b.photos.len(), "feedback": b.feedback.len() })).await;
    Ok(Json(json!({ "id": id })))
}

pub async fn delete(State(s): State<AppState>, staff: StaffAuth, Path(id): Path<Uuid>) -> AppResult<Json<Value>> {
    let n = sqlx::query("DELETE FROM trips WHERE id = $1").bind(id).execute(&s.db).await?;
    if n.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    audit(&s.db, staff.id, "delete", "trip", Some(id), json!({})).await;
    Ok(Json(json!({ "ok": true })))
}
