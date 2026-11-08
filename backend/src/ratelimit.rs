//! Small in-memory rate limiter (sliding window) and client-IP extractor.
//! State lives in this process only, which is fine for a single API instance.
use crate::{config::AppState, error::AppError};
use axum::{
    extract::{ConnectInfo, FromRequestParts},
    http::request::Parts,
};
use std::{
    collections::HashMap,
    convert::Infallible,
    net::SocketAddr,
    sync::Mutex,
    time::{Duration, Instant},
};

#[derive(Default)]
pub struct RateLimiter {
    hits: Mutex<HashMap<String, Vec<Instant>>>,
}

impl RateLimiter {
    /// Records one attempt for `key`. Fails with 429 when more than `max` attempts
    /// happened within `window`.
    pub fn check(&self, key: &str, max: usize, window: Duration) -> Result<(), AppError> {
        let now = Instant::now();
        let mut map = self.hits.lock().unwrap_or_else(|e| e.into_inner());
        // Bound memory: drop keys whose attempts have all expired.
        if map.len() > 10_000 {
            map.retain(|_, v| v.last().is_some_and(|t| now.duration_since(*t) < window));
        }
        let v = map.entry(key.to_string()).or_default();
        v.retain(|t| now.duration_since(*t) < window);
        if v.len() >= max {
            return Err(AppError::TooManyRequests);
        }
        v.push(now);
        Ok(())
    }
}

/// The caller's IP. Behind a proxy (Render) the proxy appends the real client address as the
/// LAST `X-Forwarded-For` entry; earlier entries can be forged by the client, so we ignore them.
pub struct ClientIp(pub String);

impl FromRequestParts<AppState> for ClientIp {
    type Rejection = Infallible;
    async fn from_request_parts(parts: &mut Parts, _: &AppState) -> Result<Self, Infallible> {
        let forwarded = parts
            .headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.rsplit(',').next())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let ip = forwarded.or_else(|| {
            parts
                .extensions
                .get::<ConnectInfo<SocketAddr>>()
                .map(|c| c.0.ip().to_string())
        });
        Ok(ClientIp(ip.unwrap_or_else(|| "unknown".into())))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_after_max_and_isolates_keys() {
        let rl = RateLimiter::default();
        let w = Duration::from_secs(60);
        for _ in 0..3 {
            assert!(rl.check("a", 3, w).is_ok());
        }
        assert!(rl.check("a", 3, w).is_err());
        assert!(rl.check("b", 3, w).is_ok());
    }

    #[test]
    fn window_expires() {
        let rl = RateLimiter::default();
        let w = Duration::from_millis(30);
        assert!(rl.check("a", 1, w).is_ok());
        assert!(rl.check("a", 1, w).is_err());
        std::thread::sleep(Duration::from_millis(50));
        assert!(rl.check("a", 1, w).is_ok());
    }
}
