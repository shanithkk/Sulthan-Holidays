use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub bind_addr: String,
    pub cors_origins: Vec<String>,
    pub google_client_id: Option<String>,
    pub upi_id: Option<String>,
    pub upi_payee: String,
    /// Suggested advance, as a percentage of the booking amount (staff can override per booking).
    pub advance_percent: i64,
    pub admin_email: Option<String>,
    pub admin_password: Option<String>,
}

fn opt(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// Rejects secrets that are short or still the documented placeholder.
fn check_jwt_secret(s: &str) -> Result<(), String> {
    let lower = s.to_lowercase();
    if s.len() < 32 || lower.contains("change-me") || lower.contains("changeme") {
        return Err(
            "JWT_SECRET must be at least 32 characters and not a placeholder \
                    (generate one with `openssl rand -hex 32`)"
                .into(),
        );
    }
    Ok(())
}

/// Admin password rules, checked when the admin account is created or reset.
pub fn check_admin_password(p: &str) -> Result<(), String> {
    if p.len() < 8 || p.to_lowercase().contains("change-me") {
        return Err("ADMIN_PASSWORD must be at least 8 characters and not a placeholder".into());
    }
    Ok(())
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let jwt_secret = opt("JWT_SECRET").ok_or("JWT_SECRET is required")?;
        check_jwt_secret(&jwt_secret)?;
        Ok(Self {
            database_url: opt("DATABASE_URL").ok_or("DATABASE_URL is required")?,
            jwt_secret,
            bind_addr: opt("BIND_ADDR").unwrap_or_else(|| "0.0.0.0:8080".into()),
            cors_origins: opt("CORS_ORIGINS")
                .unwrap_or_else(|| "http://localhost:3000,http://localhost:3001".into())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            google_client_id: opt("GOOGLE_CLIENT_ID"),
            upi_id: opt("UPI_ID"),
            upi_payee: opt("UPI_PAYEE").unwrap_or_else(|| "Sulthan Holidays".into()),
            advance_percent: opt("ADVANCE_PERCENT")
                .map(|v| {
                    v.parse::<i64>()
                        .map_err(|_| "ADVANCE_PERCENT must be a number 1-100")
                })
                .transpose()?
                .filter(|p| (1..=100).contains(p))
                .unwrap_or(25),
            admin_email: opt("ADMIN_EMAIL"),
            admin_password: opt("ADMIN_PASSWORD"),
        })
    }
}

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub cfg: Arc<Config>,
    pub http: reqwest::Client,
    pub limiter: Arc<crate::ratelimit::RateLimiter>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jwt_secret_rules() {
        assert!(check_jwt_secret("change-me").is_err());
        assert!(check_jwt_secret("short").is_err());
        assert!(check_jwt_secret(&"a".repeat(64)).is_ok());
    }

    #[test]
    fn admin_password_rules() {
        assert!(check_admin_password("change-me-please").is_err());
        assert!(check_admin_password("short").is_err());
        assert!(check_admin_password("a-good-password-9").is_ok());
    }
}
