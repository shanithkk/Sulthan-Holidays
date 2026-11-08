//! Vehicles: public listing, fare quote, and admin management.
use crate::{audit::audit, auth::*, config::AppState, error::*};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

#[derive(sqlx::FromRow, Serialize, Clone)]
pub struct Vehicle {
    pub id: Uuid,
    pub name: String,
    pub vehicle_type: String,
    pub seats: i32,
    pub ac: bool,
    pub photo_url: Option<String>,
    pub description: Option<String>,
    pub rate_per_km: i64,
    pub rate_per_day: i64,
    pub min_km: i32,
    pub driver_allowance: i64,
    pub night_charge: i64,
    pub active: bool,
}

const COLS: &str = "id, name, vehicle_type, seats, ac, photo_url, description, rate_per_km, \
                    rate_per_day, min_km, driver_allowance, night_charge, active";

pub async fn fetch_vehicle(db: &sqlx::PgPool, id: Uuid) -> AppResult<Vehicle> {
    Ok(
        query_as(&format!("SELECT {COLS} FROM vehicles WHERE id = $1"))
            .bind(id)
            .fetch_one(db)
            .await?,
    )
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Fare {
    pub days: i32,
    pub billable_km: i32,
    pub km_charge: i64,
    pub driver_allowance: i64,
    pub night_charge: i64,
    pub total: i64,
}

/// Fare = billable km x rate + driver allowance per day + night charge per day (if night halt).
/// Billable km is the larger of the estimate and the daily minimum km x days.
pub fn compute_fare(v: &Vehicle, days: i32, km: i32, night: bool) -> AppResult<Fare> {
    if !(1..=30).contains(&days) || !(0..=5000).contains(&km) {
        return bad("Days must be 1-30 and km 0-5000");
    }
    let billable_km = km.max(v.min_km * days);
    let km_charge = billable_km as i64 * v.rate_per_km;
    let driver_allowance = v.driver_allowance * days as i64;
    let night_charge = if night {
        v.night_charge * days as i64
    } else {
        0
    };
    Ok(Fare {
        days,
        billable_km,
        km_charge,
        driver_allowance,
        night_charge,
        total: km_charge + driver_allowance + night_charge,
    })
}

pub async fn list_public(State(s): State<AppState>) -> AppResult<Json<Vec<Vehicle>>> {
    Ok(Json(
        query_as(&format!(
            "SELECT {COLS} FROM vehicles WHERE active ORDER BY seats DESC, name"
        ))
        .fetch_all(&s.db)
        .await?,
    ))
}

#[derive(Deserialize)]
pub struct QuoteIn {
    vehicle_id: Uuid,
    days: i32,
    km: i32,
    #[serde(default)]
    night: bool,
}

pub async fn quote(State(s): State<AppState>, Json(b): Json<QuoteIn>) -> AppResult<Json<Fare>> {
    let v = fetch_vehicle(&s.db, b.vehicle_id).await?;
    if !v.active {
        return Err(AppError::NotFound);
    }
    Ok(Json(compute_fare(&v, b.days, b.km, b.night)?))
}

// ---------- admin ----------

pub async fn list_admin(State(s): State<AppState>, _: StaffAuth) -> AppResult<Json<Vec<Vehicle>>> {
    Ok(Json(
        query_as(&format!(
            "SELECT {COLS} FROM vehicles ORDER BY created_at DESC"
        ))
        .fetch_all(&s.db)
        .await?,
    ))
}

#[derive(Deserialize)]
pub struct VehicleIn {
    name: String,
    vehicle_type: String,
    seats: i32,
    ac: bool,
    photo_url: Option<String>,
    description: Option<String>,
    rate_per_km: i64,
    rate_per_day: i64,
    min_km: i32,
    driver_allowance: i64,
    night_charge: i64,
    active: bool,
}

fn validate(b: &VehicleIn) -> AppResult<()> {
    require_text(&b.name, "Name", 120)?;
    if !["traveller", "tavera", "auto"].contains(&b.vehicle_type.as_str()) {
        return bad("Vehicle type must be traveller, tavera or auto");
    }
    if b.seats < 1
        || b.min_km < 0
        || b.rate_per_km < 0
        || b.rate_per_day < 0
        || b.driver_allowance < 0
        || b.night_charge < 0
    {
        return bad("Seats must be at least 1 and rates cannot be negative");
    }
    Ok(())
}

pub async fn create(
    State(s): State<AppState>,
    staff: StaffAuth,
    Json(b): Json<VehicleIn>,
) -> AppResult<Json<Vehicle>> {
    validate(&b)?;
    let v: Vehicle = query_as(&format!(
        "INSERT INTO vehicles (name, vehicle_type, seats, ac, photo_url, description, rate_per_km, rate_per_day, \
         min_km, driver_allowance, night_charge, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING {COLS}"
    ))
    .bind(b.name.trim()).bind(&b.vehicle_type).bind(b.seats).bind(b.ac).bind(&b.photo_url).bind(&b.description)
    .bind(b.rate_per_km).bind(b.rate_per_day).bind(b.min_km).bind(b.driver_allowance).bind(b.night_charge).bind(b.active)
    .fetch_one(&s.db)
    .await?;
    audit(
        &s.db,
        staff.id,
        "create",
        "vehicle",
        Some(v.id),
        json!({ "name": v.name }),
    )
    .await;
    Ok(Json(v))
}

pub async fn update(
    State(s): State<AppState>,
    staff: StaffAuth,
    Path(id): Path<Uuid>,
    Json(b): Json<VehicleIn>,
) -> AppResult<Json<Vehicle>> {
    validate(&b)?;
    let before = fetch_vehicle(&s.db, id).await?;
    let v: Vehicle = query_as(&format!(
        "UPDATE vehicles SET name=$1, vehicle_type=$2, seats=$3, ac=$4, photo_url=$5, description=$6, rate_per_km=$7, \
         rate_per_day=$8, min_km=$9, driver_allowance=$10, night_charge=$11, active=$12 WHERE id=$13 RETURNING {COLS}"
    ))
    .bind(b.name.trim()).bind(&b.vehicle_type).bind(b.seats).bind(b.ac).bind(&b.photo_url).bind(&b.description)
    .bind(b.rate_per_km).bind(b.rate_per_day).bind(b.min_km).bind(b.driver_allowance).bind(b.night_charge).bind(b.active)
    .bind(id)
    .fetch_one(&s.db)
    .await?;
    audit(&s.db, staff.id, "update", "vehicle", Some(id), json!({
        "name": v.name, "rate_per_km": [before.rate_per_km, v.rate_per_km], "rate_per_day": [before.rate_per_day, v.rate_per_day]
    })).await;
    Ok(Json(v))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tavera() -> Vehicle {
        Vehicle {
            id: Uuid::nil(),
            name: "T".into(),
            vehicle_type: "tavera".into(),
            seats: 9,
            ac: true,
            photo_url: None,
            description: None,
            rate_per_km: 18,
            rate_per_day: 2500,
            min_km: 250,
            driver_allowance: 400,
            night_charge: 400,
            active: true,
        }
    }

    #[test]
    fn fare_uses_minimum_km() {
        let f = compute_fare(&tavera(), 2, 100, true).unwrap();
        assert_eq!(f.billable_km, 500);
        assert_eq!(f.total, 500 * 18 + 800 + 800);
    }

    #[test]
    fn fare_rejects_bad_input() {
        assert!(compute_fare(&tavera(), 0, 10, false).is_err());
        assert!(compute_fare(&tavera(), 1, 9999, false).is_err());
    }
}
