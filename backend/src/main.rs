mod accounts;
mod admin;
mod audit;
mod auth;
mod bookings;
mod config;
mod enquiries;
mod error;
mod media;
mod packages;
mod places;
mod ratelimit;
mod trips;
mod vehicles;

use axum::{
    Json, Router,
    extract::DefaultBodyLimit,
    http::{HeaderValue, Method, header},
    middleware,
    response::Response,
    routing::{get, patch, post, put},
};
use config::{AppState, Config};
use sqlx::postgres::PgPoolOptions;
use std::{net::SocketAddr, sync::Arc};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

/// Defensive headers on every API response. The API only serves JSON and photos, so the
/// CSP forbids everything else; photos are still usable in <img> tags on other sites.
async fn security_headers(mut res: Response) -> Response {
    let h = res.headers_mut();
    h.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    h.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    h.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    h.insert(
        header::STRICT_TRANSPORT_SECURITY,
        HeaderValue::from_static("max-age=63072000; includeSubDomains"),
    );
    h.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("default-src 'none'; frame-ancestors 'none'"),
    );
    // Login and account responses must never be cached; photos set their own Cache-Control.
    if !h.contains_key(header::CACHE_CONTROL) {
        h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    }
    res
}

fn router(state: AppState) -> Router {
    let origins: Vec<HeaderValue> = state
        .cfg
        .cors_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();
    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]);

    let public = Router::new()
        .route(
            "/health",
            get(|| async { Json(serde_json::json!({ "ok": true })) }),
        )
        .route("/packages", get(packages::list_public))
        .route("/media/{id}", get(media::get))
        .route("/places", get(places::list_public))
        .route("/trips", get(trips::list_public))
        .route("/packages/quote", post(packages::quote))
        .route("/packages/{slug}", get(packages::get_public))
        .route("/vehicles", get(vehicles::list_public))
        .route("/vehicles/quote", post(vehicles::quote))
        .route("/enquiries", post(enquiries::create))
        .route("/auth/register", post(accounts::register))
        .route("/auth/login", post(accounts::login))
        .route("/auth/google", post(accounts::google))
        .route("/me", get(accounts::me).patch(accounts::update_me))
        .route("/bookings", get(bookings::list_mine).post(bookings::create))
        .route("/bookings/{id}", get(bookings::get_mine))
        .route("/bookings/{id}/payment", get(bookings::payment_info))
        .route(
            "/bookings/{id}/payment-reference",
            post(bookings::submit_reference),
        );

    let admin = Router::new()
        .route("/auth/login", post(accounts::admin_login))
        .route("/me", get(accounts::admin_me))
        .route("/stats", get(admin::stats))
        .route(
            "/packages",
            get(packages::list_admin).post(packages::create),
        )
        .route(
            "/packages/{id}",
            get(packages::get_admin).put(packages::update),
        )
        .route(
            "/vehicles",
            get(vehicles::list_admin).post(vehicles::create),
        )
        .route("/vehicles/{id}", put(vehicles::update))
        .route("/enquiries", get(enquiries::list_admin))
        .route("/enquiries/{id}/status", patch(enquiries::set_status))
        .route("/bookings", get(admin::list_bookings))
        .route("/bookings/{id}/status", patch(admin::set_status))
        .route("/bookings/{id}/advance", post(admin::set_advance))
        .route("/bookings/{id}/mark-paid", post(admin::mark_paid))
        .route("/bookings/{id}/refund", post(admin::refund))
        .route("/places", get(places::list_admin).post(places::create))
        .route("/places/{id}", put(places::update))
        .route("/trips", get(trips::list_admin).post(trips::create))
        .route("/trips/{id}", put(trips::update).delete(trips::delete))
        .route(
            "/media",
            post(media::upload).layer(DefaultBodyLimit::max(media::MAX_BYTES + 1024)),
        )
        .route("/audit", get(audit::list));

    Router::new()
        .nest("/api", public)
        .nest("/api/admin", admin)
        .layer(middleware::map_response(security_headers))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Keep the admin account in step with ADMIN_EMAIL / ADMIN_PASSWORD on every start:
/// create it if missing, and reset its password (and re-activate it) if .env changed.
/// This is also the way to recover a forgotten admin password: edit .env and restart.
async fn seed_admin(state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    let (Some(email), Some(password)) = (&state.cfg.admin_email, &state.cfg.admin_password) else {
        tracing::warn!("ADMIN_EMAIL/ADMIN_PASSWORD are not set: no admin account is managed");
        return Ok(());
    };
    config::check_admin_password(password)?;
    let email = email.to_lowercase();
    let current: Option<String> =
        sqlx::query_scalar("SELECT password_hash FROM staff WHERE email = $1")
            .bind(&email)
            .fetch_optional(&state.db)
            .await?;
    match current {
        None => {
            let hash = auth::hash_password(password).map_err(|e| e.to_string())?;
            sqlx::query(
                "INSERT INTO staff (name, email, password_hash, role) VALUES ('Admin', $1, $2, 'admin')",
            )
            .bind(&email)
            .bind(hash)
            .execute(&state.db)
            .await?;
            tracing::info!("Created admin account {email}");
        }
        Some(hash) if !auth::verify_password(password, &hash) => {
            let hash = auth::hash_password(password).map_err(|e| e.to_string())?;
            sqlx::query("UPDATE staff SET password_hash = $1, active = TRUE WHERE email = $2")
                .bind(hash)
                .bind(&email)
                .execute(&state.db)
                .await?;
            tracing::info!("Admin password for {email} updated from ADMIN_PASSWORD");
        }
        Some(_) => {}
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // backend/.env wins over variables already in the shell (a stale or empty exported ADMIN_EMAIL
    // would otherwise silently hide the .env value). Production without a .env file is unaffected.
    let dotenv_result = dotenvy::dotenv_override();
    tracing_subscriber::fmt().init();
    match dotenv_result {
        // A malformed line stops loading, so every variable after it would be missing. Say so loudly.
        Err(e) if !e.not_found() => {
            tracing::error!(
                "backend/.env could not be fully read: {e}. Variables after the bad line are NOT loaded"
            );
        }
        _ => {}
    }
    let cfg = Config::from_env()?;

    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&cfg.database_url)
        .await?;
    sqlx::migrate!("./migrations").run(&db).await?;

    let state = AppState {
        db,
        cfg: Arc::new(cfg),
        http: reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()?,
        limiter: Arc::new(ratelimit::RateLimiter::default()),
    };
    seed_admin(&state).await?;

    let listener = tokio::net::TcpListener::bind(&state.cfg.bind_addr).await?;
    tracing::info!("API listening on {}", state.cfg.bind_addr);
    axum::serve(
        listener,
        router(state).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}
