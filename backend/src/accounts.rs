//! Customer sign-up / sign-in (email + password, or Google) and staff sign-in.
use crate::{audit::audit, auth::*, config::AppState, error::*, ratelimit::ClientIp};
use axum::{Json, extract::State};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::time::Duration;
use uuid::Uuid;

#[derive(sqlx::FromRow)]
struct UserRow {
    id: Uuid,
    name: String,
    email: String,
    phone: Option<String>,
    password_hash: Option<String>,
}

fn user_json(u: &UserRow) -> Value {
    json!({ "id": u.id, "name": u.name, "email": u.email, "phone": u.phone,
            "needs_phone": u.phone.is_none() })
}

fn session(state: &AppState, u: &UserRow) -> AppResult<Json<Value>> {
    let token = make_token(state, u.id, "customer")?;
    Ok(Json(json!({ "token": token, "user": user_json(u) })))
}

const USER_COLS: &str = "id, name, email, phone, password_hash";

#[derive(Deserialize)]
pub struct RegisterIn {
    name: String,
    email: String,
    phone: String,
    password: String,
}

const FIVE_MIN: Duration = Duration::from_secs(300);
const HOUR: Duration = Duration::from_secs(3600);

pub async fn register(
    State(s): State<AppState>,
    ClientIp(ip): ClientIp,
    Json(b): Json<RegisterIn>,
) -> AppResult<Json<Value>> {
    s.limiter.check(&format!("register:{ip}"), 5, HOUR)?;
    let name = require_text(&b.name, "Name", 100)?;
    let email = normalize_email(&b.email)?;
    let phone = normalize_phone(&b.phone)?;
    if b.password.len() < 8 || b.password.len() > 128 {
        return bad("Password must be 8 to 128 characters");
    }
    let hash = hash_password(&b.password)?;
    let u: UserRow = query_as(&format!(
        "INSERT INTO users (name, email, phone, password_hash) VALUES ($1,$2,$3,$4) RETURNING {USER_COLS}"
    ))
    .bind(name)
    .bind(&email)
    .bind(phone)
    .bind(hash)
    .fetch_one(&s.db)
    .await
    .map_err(|e| match AppError::from(e) {
        AppError::Conflict(_) => {
            AppError::Conflict("Could not create the account. Try signing in instead".into())
        }
        other => other,
    })?;
    session(&s, &u)
}

#[derive(Deserialize)]
pub struct LoginIn {
    email: String,
    password: String,
}

pub async fn login(
    State(s): State<AppState>,
    ClientIp(ip): ClientIp,
    Json(b): Json<LoginIn>,
) -> AppResult<Json<Value>> {
    let email = b.email.trim().to_lowercase();
    s.limiter.check(&format!("login-ip:{ip}"), 20, FIVE_MIN)?;
    s.limiter
        .check(&format!("login-email:{email}"), 8, FIVE_MIN)?;
    let u: Option<UserRow> = query_as(&format!("SELECT {USER_COLS} FROM users WHERE email = $1"))
        .bind(&email)
        .fetch_optional(&s.db)
        .await?;
    let Some(u) = u else {
        burn_password_time(&b.password);
        return Err(AppError::Unauthorized);
    };
    match &u.password_hash {
        Some(h) if verify_password(&b.password, h) => session(&s, &u),
        Some(_) => Err(AppError::Unauthorized),
        None => {
            // Same answer as a wrong password, so login cannot reveal which emails exist.
            burn_password_time(&b.password);
            Err(AppError::Unauthorized)
        }
    }
}

#[derive(Deserialize)]
pub struct GoogleIn {
    id_token: String,
}

#[derive(Deserialize)]
struct GoogleClaims {
    aud: String,
    iss: String,
    sub: String,
    email: String,
    email_verified: String,
    name: Option<String>,
}

pub async fn google(
    State(s): State<AppState>,
    ClientIp(ip): ClientIp,
    Json(b): Json<GoogleIn>,
) -> AppResult<Json<Value>> {
    let Some(client_id) = s.cfg.google_client_id.clone() else {
        return bad("Google sign-in is not enabled");
    };
    s.limiter.check(&format!("google:{ip}"), 20, FIVE_MIN)?;
    // Google verifies the signature and expiry for us.
    let resp = s
        .http
        .get("https://oauth2.googleapis.com/tokeninfo")
        .query(&[("id_token", b.id_token.as_str())])
        .send()
        .await
        .map_err(|e| {
            tracing::error!("google tokeninfo: {e}");
            AppError::Internal
        })?;
    if !resp.status().is_success() {
        return Err(AppError::Unauthorized);
    }
    let g: GoogleClaims = resp.json().await.map_err(|_| AppError::Unauthorized)?;
    let issuer_ok = g.iss == "accounts.google.com" || g.iss == "https://accounts.google.com";
    if g.aud != client_id || !issuer_ok || g.email_verified != "true" {
        return Err(AppError::Unauthorized);
    }
    let email = g.email.to_lowercase();
    let name = g.name.unwrap_or_else(|| email.clone());

    let existing: Option<UserRow> = query_as(&format!(
        "SELECT {USER_COLS} FROM users WHERE google_sub = $1 OR email = $2"
    ))
    .bind(&g.sub)
    .bind(&email)
    .fetch_optional(&s.db)
    .await?;
    let u = match existing {
        Some(u) => {
            // Anyone can register a password account with an email they do not own. When the real
            // owner proves the email through Google, link it AND drop the password, so whoever
            // pre-registered it can no longer sign in. An account already tied to a different
            // Google identity is refused.
            let linked: Option<UserRow> = query_as(&format!(
                "UPDATE users SET google_sub = COALESCE(google_sub, $1), \
                 password_hash = CASE WHEN google_sub IS NULL THEN NULL ELSE password_hash END \
                 WHERE id = $2 AND (google_sub IS NULL OR google_sub = $1) RETURNING {USER_COLS}"
            ))
            .bind(&g.sub)
            .bind(u.id)
            .fetch_optional(&s.db)
            .await?;
            let Some(linked) = linked else {
                return Err(AppError::Unauthorized);
            };
            linked
        }
        None => query_as(&format!(
            "INSERT INTO users (name, email, google_sub) VALUES ($1,$2,$3) RETURNING {USER_COLS}"
        ))
        .bind(name)
        .bind(&email)
        .bind(&g.sub)
        .fetch_one(&s.db)
        .await?,
    };
    session(&s, &u)
}

pub async fn me(
    State(s): State<AppState>,
    CustomerAuth(id): CustomerAuth,
) -> AppResult<Json<Value>> {
    let u: UserRow = query_as(&format!("SELECT {USER_COLS} FROM users WHERE id = $1"))
        .bind(id)
        .fetch_one(&s.db)
        .await
        .map_err(|_| AppError::Unauthorized)?;
    Ok(Json(user_json(&u)))
}

#[derive(Deserialize)]
pub struct ProfileIn {
    name: Option<String>,
    phone: Option<String>,
}

pub async fn update_me(
    State(s): State<AppState>,
    CustomerAuth(id): CustomerAuth,
    Json(b): Json<ProfileIn>,
) -> AppResult<Json<Value>> {
    let name = b
        .name
        .as_deref()
        .map(|n| require_text(n, "Name", 100))
        .transpose()?;
    let phone = b.phone.as_deref().map(normalize_phone).transpose()?;
    let u: UserRow = query_as(&format!(
        "UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone) WHERE id = $3 RETURNING {USER_COLS}"
    ))
    .bind(name)
    .bind(phone)
    .bind(id)
    .fetch_one(&s.db)
    .await?;
    Ok(Json(user_json(&u)))
}

// ---------- staff ----------

#[derive(sqlx::FromRow, Serialize)]
pub struct StaffRow {
    id: Uuid,
    name: String,
    email: String,
    role: String,
    #[serde(skip)]
    password_hash: String,
    #[serde(skip)]
    active: bool,
}

pub async fn admin_login(
    State(s): State<AppState>,
    ClientIp(ip): ClientIp,
    Json(b): Json<LoginIn>,
) -> AppResult<Json<Value>> {
    let email = b.email.trim().to_lowercase();
    s.limiter.check(&format!("admin-ip:{ip}"), 10, FIVE_MIN)?;
    s.limiter
        .check(&format!("admin-email:{email}"), 5, Duration::from_secs(900))?;
    let st: Option<StaffRow> = sqlx::query_as(
        "SELECT id, name, email, role, password_hash, active FROM staff WHERE email = $1",
    )
    .bind(&email)
    .fetch_optional(&s.db)
    .await?;
    match st {
        Some(st) if st.active && verify_password(&b.password, &st.password_hash) => {
            let token = make_token(&s, st.id, &st.role)?;
            audit(
                &s.db,
                st.id,
                "login",
                "staff",
                Some(st.id),
                json!({ "ip": ip }),
            )
            .await;
            Ok(Json(json!({ "token": token, "staff": st })))
        }
        other => {
            if other.is_none() {
                burn_password_time(&b.password);
            }
            tracing::warn!("failed admin login for {email} from {ip}");
            Err(AppError::Unauthorized)
        }
    }
}

pub async fn admin_me(State(s): State<AppState>, staff: StaffAuth) -> AppResult<Json<StaffRow>> {
    Ok(Json(
        sqlx::query_as(
            "SELECT id, name, email, role, password_hash, active FROM staff WHERE id = $1",
        )
        .bind(staff.id)
        .fetch_one(&s.db)
        .await?,
    ))
}
