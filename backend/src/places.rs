//! "Places you will love": places with several photos each. Public read, staff edit.
use crate::{audit::audit, auth::*, config::AppState, error::*};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(sqlx::FromRow, Serialize)]
struct PlaceRow {
    id: Uuid,
    slug: String,
    name: String,
    description: String,
    sort_order: i32,
    active: bool,
}

#[derive(sqlx::FromRow)]
struct PhotoRow {
    place_id: Uuid,
    url: String,
    caption: Option<String>,
    credit: Option<String>,
    source_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Photo {
    url: String,
    caption: Option<String>,
    /// e.g. "Ingo Mehling, CC BY-SA 4.0". Leave empty for your own photos.
    credit: Option<String>,
    source_url: Option<String>,
}

#[derive(Serialize)]
pub struct Place {
    #[serde(flatten)]
    row: PlaceRow,
    photos: Vec<Photo>,
}

async fn load(db: &PgPool, only_active: bool) -> AppResult<Vec<Place>> {
    let sql = if only_active {
        "SELECT id, slug, name, description, sort_order, active FROM places WHERE active ORDER BY sort_order, name"
    } else {
        "SELECT id, slug, name, description, sort_order, active FROM places ORDER BY sort_order, name"
    };
    let rows: Vec<PlaceRow> = sqlx::query_as(sql).fetch_all(db).await?;
    let photos: Vec<PhotoRow> = sqlx::query_as(
        "SELECT place_id, url, caption, credit, source_url FROM place_photos ORDER BY place_id, sort_order",
    )
    .fetch_all(db)
    .await?;
    let mut by_place: HashMap<Uuid, Vec<Photo>> = HashMap::new();
    for p in photos {
        by_place.entry(p.place_id).or_default().push(Photo {
            url: p.url,
            caption: p.caption,
            credit: p.credit,
            source_url: p.source_url,
        });
    }
    Ok(rows
        .into_iter()
        .map(|row| Place {
            photos: by_place.remove(&row.id).unwrap_or_default(),
            row,
        })
        .collect())
}

pub async fn list_public(State(s): State<AppState>) -> AppResult<Json<Vec<Place>>> {
    // Hide places that have no photos yet.
    let mut v = load(&s.db, true).await?;
    v.retain(|p| !p.photos.is_empty());
    Ok(Json(v))
}

pub async fn list_admin(State(s): State<AppState>, _: StaffAuth) -> AppResult<Json<Vec<Place>>> {
    Ok(Json(load(&s.db, false).await?))
}

#[derive(Deserialize)]
pub struct PlaceIn {
    slug: String,
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    sort_order: i32,
    active: bool,
    #[serde(default)]
    photos: Vec<Photo>,
}

/// Photo URLs end up in CSS and <img>, so only our own paths and https links are accepted.
pub fn safe_url(u: &str) -> bool {
    let ok_start = u.starts_with("https://") || (u.starts_with('/') && !u.starts_with("//"));
    ok_start && u.len() <= 500 && !u.chars().any(|c| c.is_whitespace() || c == '"' || c == '\'' || c == '(' || c == ')')
}

fn validate(b: &PlaceIn) -> AppResult<String> {
    require_text(&b.name, "Name", 100)?;
    if b.description.chars().count() > 1000 {
        return bad("Description is too long (max 1000 characters)");
    }
    let slug = b.slug.trim().to_lowercase();
    if slug.is_empty() || !slug.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return bad("Slug may only contain letters, numbers and dashes");
    }
    if b.photos.len() > 30 {
        return bad("At most 30 photos per place");
    }
    for p in &b.photos {
        if !safe_url(&p.url) {
            return bad("Each photo needs an uploaded file or an https:// image link");
        }
        if p.source_url.as_deref().is_some_and(|u| !u.is_empty() && !u.starts_with("https://")) {
            return bad("Source link must start with https://");
        }
    }
    Ok(slug)
}

async fn save_photos(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    place: Uuid,
    photos: &[Photo],
) -> AppResult<()> {
    sqlx::query("DELETE FROM place_photos WHERE place_id = $1")
        .bind(place)
        .execute(&mut **tx)
        .await?;
    let blank = |o: &Option<String>| o.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(String::from);
    for (i, p) in photos.iter().enumerate() {
        sqlx::query(
            "INSERT INTO place_photos (place_id, url, caption, credit, source_url, sort_order) VALUES ($1,$2,$3,$4,$5,$6)",
        )
        .bind(place)
        .bind(&p.url)
        .bind(blank(&p.caption))
        .bind(blank(&p.credit))
        .bind(blank(&p.source_url))
        .bind(i as i32)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

pub async fn create(
    State(s): State<AppState>,
    staff: StaffAuth,
    Json(b): Json<PlaceIn>,
) -> AppResult<Json<serde_json::Value>> {
    let slug = validate(&b)?;
    let mut tx = s.db.begin().await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO places (slug, name, description, sort_order, active) VALUES ($1,$2,$3,$4,$5) RETURNING id",
    )
    .bind(&slug)
    .bind(b.name.trim())
    .bind(b.description.trim())
    .bind(b.sort_order)
    .bind(b.active)
    .fetch_one(&mut *tx)
    .await?;
    save_photos(&mut tx, id, &b.photos).await?;
    tx.commit().await?;
    audit(&s.db, staff.id, "create", "place", Some(id), json!({ "name": b.name })).await;
    Ok(Json(json!({ "id": id })))
}

pub async fn update(
    State(s): State<AppState>,
    staff: StaffAuth,
    Path(id): Path<Uuid>,
    Json(b): Json<PlaceIn>,
) -> AppResult<Json<serde_json::Value>> {
    let slug = validate(&b)?;
    let mut tx = s.db.begin().await?;
    let n = sqlx::query(
        "UPDATE places SET slug=$1, name=$2, description=$3, sort_order=$4, active=$5 WHERE id=$6",
    )
    .bind(&slug)
    .bind(b.name.trim())
    .bind(b.description.trim())
    .bind(b.sort_order)
    .bind(b.active)
    .bind(id)
    .execute(&mut *tx)
    .await?;
    if n.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    save_photos(&mut tx, id, &b.photos).await?;
    tx.commit().await?;
    audit(&s.db, staff.id, "update", "place", Some(id), json!({ "name": b.name, "photos": b.photos.len() })).await;
    Ok(Json(json!({ "id": id })))
}

#[cfg(test)]
mod tests {
    use super::safe_url;

    #[test]
    fn only_safe_photo_urls() {
        assert!(safe_url("/api/media/abc"));
        assert!(safe_url("/images/places/x.jpg"));
        assert!(safe_url("https://upload.wikimedia.org/a.jpg"));
        assert!(!safe_url("javascript:alert(1)"));
        assert!(!safe_url("http://insecure.example/a.jpg"));
        assert!(!safe_url("//evil.example/a.jpg"));
        assert!(!safe_url("/a.jpg\") ; background:url(x"));
        assert!(!safe_url("data:image/png;base64,AAAA"));
    }
}
