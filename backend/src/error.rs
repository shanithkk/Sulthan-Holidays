use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(String),
    #[error("Please sign in")]
    Unauthorized,
    #[error("Not allowed")]
    Forbidden,
    #[error("Not found")]
    NotFound,
    #[error("{0}")]
    Conflict(String),
    #[error("Too many attempts. Please wait a few minutes and try again")]
    TooManyRequests,
    #[error("Something went wrong")]
    Internal,
}

pub type AppResult<T> = Result<T, AppError>;

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        match &e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            sqlx::Error::Database(d) if d.is_unique_violation() => {
                AppError::Conflict("Already exists".into())
            }
            sqlx::Error::Database(d) if d.is_foreign_key_violation() => {
                AppError::BadRequest("Referenced record does not exist or is in use".into())
            }
            _ => {
                tracing::error!("database error: {e}");
                AppError::Internal
            }
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match self {
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Unauthorized => StatusCode::UNAUTHORIZED,
            AppError::Forbidden => StatusCode::FORBIDDEN,
            AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::TooManyRequests => StatusCode::TOO_MANY_REQUESTS,
            AppError::Internal => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, Json(json!({ "error": self.to_string() }))).into_response()
    }
}

/// `sqlx::query_as` for SQL built from this crate's own `const` column lists.
/// sqlx 0.9 refuses `format!` strings unless they are explicitly marked as audited; every
/// string passed here is a compile-time constant joined with other constants, never user input.
pub fn query_as<'q, O>(
    sql: &str,
) -> sqlx::query::QueryAs<'q, sqlx::Postgres, O, sqlx::postgres::PgArguments>
where
    O: Send + Unpin + for<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow>,
{
    sqlx::query_as(sqlx::AssertSqlSafe(sql.to_owned()))
}

pub fn bad<T>(msg: &str) -> AppResult<T> {
    Err(AppError::BadRequest(msg.into()))
}
