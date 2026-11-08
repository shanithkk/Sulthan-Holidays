//! Tokens, password hashing, request extractors and shared validation.
use crate::{
    config::AppState,
    error::{AppError, AppResult, bad},
};
use argon2::{Argon2, PasswordHasher, PasswordVerifier, password_hash::phc::PasswordHash};
use axum::{extract::FromRequestParts, http::request::Parts};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use uuid::Uuid;

const CUSTOMER_TOKEN_HOURS: i64 = 12;
/// Staff tokens live shorter: they unlock payments, refunds and customer data.
const STAFF_TOKEN_HOURS: i64 = 4;

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: Uuid,
    /// "customer", "staff" or "admin"
    role: String,
    exp: usize,
}

pub fn make_token(state: &AppState, id: Uuid, role: &str) -> AppResult<String> {
    let hours = if role == "customer" {
        CUSTOMER_TOKEN_HOURS
    } else {
        STAFF_TOKEN_HOURS
    };
    let exp = (chrono::Utc::now() + chrono::Duration::hours(hours)).timestamp() as usize;
    let claims = Claims {
        sub: id,
        role: role.into(),
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.cfg.jwt_secret.as_bytes()),
    )
    .map_err(|e| {
        tracing::error!("jwt encode: {e}");
        AppError::Internal
    })
}

fn read_claims(parts: &Parts, state: &AppState) -> Option<Claims> {
    let header = parts.headers.get("authorization")?.to_str().ok()?;
    let token = header.strip_prefix("Bearer ")?;
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.cfg.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .ok()
    .map(|d| d.claims)
}

pub fn hash_password(pw: &str) -> AppResult<String> {
    Argon2::default()
        .hash_password(pw.as_bytes())
        .map(|h| h.to_string())
        .map_err(|e| {
            tracing::error!("hash: {e}");
            AppError::Internal
        })
}

pub fn verify_password(pw: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .map(|h| Argon2::default().verify_password(pw.as_bytes(), &h).is_ok())
        .unwrap_or(false)
}

/// Verify a password against a throwaway hash so a login for an unknown email takes as long
/// as one for a known email (otherwise response time reveals which emails have accounts).
pub fn burn_password_time(pw: &str) {
    static DUMMY: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    let hash = DUMMY.get_or_init(|| hash_password("timing-equaliser").unwrap_or_default());
    let _ = verify_password(pw, hash);
}

/// Logged-in customer.
pub struct CustomerAuth(pub Uuid);

impl FromRequestParts<AppState> for CustomerAuth {
    type Rejection = AppError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, AppError> {
        match read_claims(parts, state) {
            Some(c) if c.role == "customer" => {
                // Deleted accounts lose access immediately.
                let exists: Option<bool> =
                    sqlx::query_scalar("SELECT TRUE FROM users WHERE id = $1")
                        .bind(c.sub)
                        .fetch_optional(&state.db)
                        .await?;
                if exists.is_none() {
                    return Err(AppError::Unauthorized);
                }
                Ok(CustomerAuth(c.sub))
            }
            Some(_) => Err(AppError::Forbidden),
            None => Err(AppError::Unauthorized),
        }
    }
}

/// Customer if a valid token is sent, otherwise `None`. Never rejects.
pub struct MaybeCustomer(pub Option<Uuid>);

impl FromRequestParts<AppState> for MaybeCustomer {
    type Rejection = Infallible;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Infallible> {
        Ok(MaybeCustomer(
            read_claims(parts, state)
                .filter(|c| c.role == "customer")
                .map(|c| c.sub),
        ))
    }
}

/// Logged-in staff member (admin panel).
pub struct StaffAuth {
    pub id: Uuid,
    /// "staff" or "admin", read from the database (not from the token).
    pub role: String,
}

impl FromRequestParts<AppState> for StaffAuth {
    type Rejection = AppError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, AppError> {
        match read_claims(parts, state) {
            Some(c) if c.role == "staff" || c.role == "admin" => {
                // Re-check the account so deactivated or demoted staff are cut off immediately.
                let row: Option<(bool, String)> =
                    sqlx::query_as("SELECT active, role FROM staff WHERE id = $1")
                        .bind(c.sub)
                        .fetch_optional(&state.db)
                        .await?;
                match row {
                    Some((true, role)) => Ok(StaffAuth { id: c.sub, role }),
                    _ => Err(AppError::Unauthorized),
                }
            }
            Some(_) => Err(AppError::Forbidden),
            None => Err(AppError::Unauthorized),
        }
    }
}

/// Admin only (e.g. refunds). Regular staff get 403.
pub struct AdminAuth(pub StaffAuth);

impl FromRequestParts<AppState> for AdminAuth {
    type Rejection = AppError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, AppError> {
        let staff = StaffAuth::from_request_parts(parts, state).await?;
        if staff.role != "admin" {
            return Err(AppError::Forbidden);
        }
        Ok(AdminAuth(staff))
    }
}

/// Indian mobile number -> "+91XXXXXXXXXX".
pub fn normalize_phone(raw: &str) -> AppResult<String> {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    let ten = match digits.len() {
        10 => digits.as_str(),
        12 if digits.starts_with("91") => &digits[2..],
        11 if digits.starts_with('0') => &digits[1..],
        _ => return bad("Enter a valid 10-digit mobile number"),
    };
    if !matches!(ten.as_bytes()[0], b'6'..=b'9') {
        return bad("Enter a valid 10-digit mobile number");
    }
    Ok(format!("+91{ten}"))
}

pub fn normalize_email(raw: &str) -> AppResult<String> {
    let e = raw.trim().to_lowercase();
    let ok = e.len() <= 254
        && e.split_once('@')
            .is_some_and(|(l, d)| !l.is_empty() && d.contains('.') && !d.ends_with('.'))
        && !e.contains(' ');
    if ok {
        Ok(e)
    } else {
        bad("Enter a valid email address")
    }
}

pub fn require_text(v: &str, field: &str, max: usize) -> AppResult<String> {
    let t = v.trim();
    if t.is_empty() || t.chars().count() > max {
        return bad(&format!("{field} is required (max {max} characters)"));
    }
    Ok(t.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phone_formats() {
        assert_eq!(normalize_phone("98765 43210").unwrap(), "+919876543210");
        assert_eq!(normalize_phone("+91 98765-43210").unwrap(), "+919876543210");
        assert_eq!(normalize_phone("09876543210").unwrap(), "+919876543210");
        assert!(normalize_phone("12345").is_err());
        assert!(normalize_phone("5876543210").is_err());
    }

    #[test]
    fn password_roundtrip() {
        let h = hash_password("correct horse").unwrap();
        assert!(verify_password("correct horse", &h));
        assert!(!verify_password("wrong", &h));
    }

    #[test]
    fn email_checks() {
        assert_eq!(normalize_email(" A@B.com ").unwrap(), "a@b.com");
        assert!(normalize_email("nope").is_err());
    }
}
