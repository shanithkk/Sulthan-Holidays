//! Photo upload (staff) and serving (public). The request body is the raw image file.
use crate::{audit::audit, auth::StaffAuth, config::AppState, error::*};
use axum::{
    Json,
    body::Bytes,
    extract::{Path, Query, State},
    http::header,
    response::IntoResponse,
};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

pub const MAX_BYTES: usize = 5 * 1024 * 1024;

/// The file type is decided from the file's own first bytes, never from the client's headers or name.
fn sniff(b: &[u8]) -> Option<&'static str> {
    if b.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if b.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if b.len() > 12 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

#[derive(Deserialize)]
pub struct UploadQuery {
    filename: Option<String>,
}

pub async fn upload(
    State(s): State<AppState>,
    staff: StaffAuth,
    Query(q): Query<UploadQuery>,
    body: Bytes,
) -> AppResult<Json<Value>> {
    if body.is_empty() {
        return bad("No file received");
    }
    if body.len() > MAX_BYTES {
        return bad("Photo is too large (max 5 MB)");
    }
    let Some(content_type) = sniff(&body) else {
        return bad("Only JPG, PNG or WebP photos are allowed");
    };
    let filename = q
        .filename
        .map(|f| f.chars().take(100).collect::<String>())
        .filter(|f| !f.is_empty());
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO media (content_type, filename, data, created_by) VALUES ($1,$2,$3,$4) RETURNING id",
    )
    .bind(content_type)
    .bind(&filename)
    .bind(body.as_ref())
    .bind(staff.id)
    .fetch_one(&s.db)
    .await?;
    audit(
        &s.db,
        staff.id,
        "upload",
        "media",
        Some(id),
        json!({ "filename": filename, "bytes": body.len() }),
    )
    .await;
    Ok(Json(json!({ "id": id, "url": format!("/api/media/{id}") })))
}

pub async fn get(State(s): State<AppState>, Path(id): Path<Uuid>) -> AppResult<impl IntoResponse> {
    let (content_type, data): (String, Vec<u8>) =
        sqlx::query_as("SELECT content_type, data FROM media WHERE id = $1")
            .bind(id)
            .fetch_one(&s.db)
            .await?;
    Ok((
        [
            (header::CONTENT_TYPE, content_type),
            // Ids are never reused, so the file behind a URL never changes.
            (header::CACHE_CONTROL, "public, max-age=31536000, immutable".into()),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".into()),
        ],
        data,
    ))
}

#[cfg(test)]
mod tests {
    use super::sniff;

    #[test]
    fn detects_real_images_only() {
        assert_eq!(sniff(&[0xFF, 0xD8, 0xFF, 0xE0, 0, 0]), Some("image/jpeg"));
        assert_eq!(sniff(b"\x89PNG\r\n\x1a\n...."), Some("image/png"));
        assert_eq!(sniff(b"RIFF\x00\x00\x00\x00WEBPVP8 "), Some("image/webp"));
        assert_eq!(sniff(b"<svg onload=alert(1)>"), None);
        assert_eq!(sniff(b"<html></html>"), None);
        assert_eq!(sniff(b""), None);
    }
}
