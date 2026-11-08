//! Tour packages: public listing/detail and admin management.
use crate::{audit::audit, auth::*, config::AppState, error::*};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(sqlx::FromRow, Serialize)]
pub struct Package {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub category: String,
    pub summary: String,
    pub duration_days: i32,
    /// Price of ONE car for the whole trip (cars needed = group size / seats of `vehicle_id`).
    pub car_price: i64,
    /// Per room per night; 0 means this package does not offer a hotel add-on.
    pub hotel_price_per_room_night: i64,
    /// Fixed charge for pickup from the customer's location (0 = free pickup).
    pub pickup_price: i64,
    pub persons_per_room: i32,
    pub vehicle_id: Option<Uuid>,
    pub hotel_name: Option<String>,
    pub cover_image: Option<String>,
    pub includes: Vec<String>,
    pub active: bool,
}

#[derive(sqlx::FromRow, Serialize)]
pub struct PackageItem {
    pub day_number: i32,
    pub title: String,
    pub description: String,
    pub places: String,
}

#[derive(Serialize)]
pub struct PackageDetail {
    #[serde(flatten)]
    package: Package,
    vehicle_name: Option<String>,
    vehicle_seats: Option<i32>,
    items: Vec<PackageItem>,
}

const COLS: &str = "id, slug, title, category, summary, duration_days, car_price, \
                    hotel_price_per_room_night, pickup_price, persons_per_room, vehicle_id, \
                    hotel_name, cover_image, includes, active";

pub async fn fetch_package(db: &PgPool, id: Uuid) -> AppResult<Package> {
    Ok(
        query_as(&format!("SELECT {COLS} FROM packages WHERE id = $1"))
            .bind(id)
            .fetch_one(db)
            .await?,
    )
}

async fn detail(db: &PgPool, package: Package) -> AppResult<PackageDetail> {
    let items = sqlx::query_as(
        "SELECT day_number, title, description, places FROM package_items WHERE package_id = $1 ORDER BY day_number",
    )
    .bind(package.id)
    .fetch_all(db)
    .await?;
    let vehicle: Option<(String, i32)> = match package.vehicle_id {
        Some(v) => {
            sqlx::query_as("SELECT name, seats FROM vehicles WHERE id = $1")
                .bind(v)
                .fetch_optional(db)
                .await?
        }
        None => None,
    };
    Ok(PackageDetail {
        package,
        vehicle_name: vehicle.as_ref().map(|v| v.0.clone()),
        vehicle_seats: vehicle.map(|v| v.1),
        items,
    })
}

pub async fn list_public(State(s): State<AppState>) -> AppResult<Json<Vec<Package>>> {
    Ok(Json(
        query_as(&format!(
            "SELECT {COLS} FROM packages WHERE active ORDER BY created_at"
        ))
        .fetch_all(&s.db)
        .await?,
    ))
}

pub async fn get_public(
    State(s): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Json<PackageDetail>> {
    let p: Package = query_as(&format!(
        "SELECT {COLS} FROM packages WHERE slug = $1 AND active"
    ))
    .bind(slug)
    .fetch_one(&s.db)
    .await?;
    Ok(Json(detail(&s.db, p).await?))
}

// ---------- admin ----------

pub async fn list_admin(State(s): State<AppState>, _: StaffAuth) -> AppResult<Json<Vec<Package>>> {
    Ok(Json(
        query_as(&format!(
            "SELECT {COLS} FROM packages ORDER BY created_at DESC"
        ))
        .fetch_all(&s.db)
        .await?,
    ))
}

pub async fn get_admin(
    State(s): State<AppState>,
    _: StaffAuth,
    Path(id): Path<Uuid>,
) -> AppResult<Json<PackageDetail>> {
    let p = fetch_package(&s.db, id).await?;
    Ok(Json(detail(&s.db, p).await?))
}

#[derive(Deserialize)]
pub struct ItemIn {
    day_number: i32,
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    places: String,
}

#[derive(Deserialize)]
pub struct PackageIn {
    slug: String,
    title: String,
    category: String,
    summary: String,
    duration_days: i32,
    car_price: i64,
    #[serde(default)]
    hotel_price_per_room_night: i64,
    #[serde(default)]
    pickup_price: i64,
    #[serde(default = "two")]
    persons_per_room: i32,
    vehicle_id: Option<Uuid>,
    hotel_name: Option<String>,
    cover_image: Option<String>,
    #[serde(default)]
    includes: Vec<String>,
    active: bool,
    #[serde(default)]
    items: Vec<ItemIn>,
}

fn validate(b: &PackageIn) -> AppResult<String> {
    require_text(&b.title, "Title", 150)?;
    require_text(&b.category, "Category", 50)?;
    require_text(&b.summary, "Summary", 500)?;
    let slug = b.slug.trim().to_lowercase();
    if slug.is_empty() || !slug.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return bad("Slug may only contain letters, numbers and dashes");
    }
    if b.duration_days < 1 {
        return bad("Duration must be at least 1 day");
    }
    if b.car_price < 0 || b.hotel_price_per_room_night < 0 || b.pickup_price < 0 {
        return bad("Prices cannot be negative");
    }
    if b.persons_per_room < 1 {
        return bad("Persons per room must be at least 1");
    }
    if b.vehicle_id.is_none() {
        return bad("Choose the vehicle for this package (the car price is for that vehicle)");
    }
    if b.items
        .iter()
        .any(|i| i.day_number < 1 || i.title.trim().is_empty())
    {
        return bad("Each itinerary day needs a day number and title");
    }
    Ok(slug)
}

async fn save_items(
    tx: &mut Transaction<'_, Postgres>,
    pkg: Uuid,
    items: &[ItemIn],
) -> AppResult<()> {
    sqlx::query("DELETE FROM package_items WHERE package_id = $1")
        .bind(pkg)
        .execute(&mut **tx)
        .await?;
    for i in items {
        sqlx::query("INSERT INTO package_items (package_id, day_number, title, description, places) VALUES ($1,$2,$3,$4,$5)")
            .bind(pkg).bind(i.day_number).bind(i.title.trim()).bind(&i.description).bind(&i.places)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

pub async fn create(
    State(s): State<AppState>,
    staff: StaffAuth,
    Json(b): Json<PackageIn>,
) -> AppResult<Json<PackageDetail>> {
    let slug = validate(&b)?;
    let mut tx = s.db.begin().await?;
    let p: Package = query_as(&format!(
        "INSERT INTO packages (slug, title, category, summary, duration_days, car_price, hotel_price_per_room_night, \
         pickup_price, persons_per_room, vehicle_id, hotel_name, cover_image, includes, active) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING {COLS}"
    ))
    .bind(&slug).bind(b.title.trim()).bind(b.category.trim()).bind(b.summary.trim()).bind(b.duration_days)
    .bind(b.car_price).bind(b.hotel_price_per_room_night).bind(b.pickup_price).bind(b.persons_per_room)
    .bind(b.vehicle_id).bind(&b.hotel_name).bind(&b.cover_image).bind(&b.includes).bind(b.active)
    .fetch_one(&mut *tx)
    .await?;
    save_items(&mut tx, p.id, &b.items).await?;
    tx.commit().await?;
    audit(
        &s.db,
        staff.id,
        "create",
        "package",
        Some(p.id),
        json!({ "title": p.title }),
    )
    .await;
    Ok(Json(detail(&s.db, p).await?))
}

pub async fn update(
    State(s): State<AppState>,
    staff: StaffAuth,
    Path(id): Path<Uuid>,
    Json(b): Json<PackageIn>,
) -> AppResult<Json<PackageDetail>> {
    let slug = validate(&b)?;
    let before = fetch_package(&s.db, id).await?;
    let mut tx = s.db.begin().await?;
    let p: Package = query_as(&format!(
        "UPDATE packages SET slug=$1, title=$2, category=$3, summary=$4, duration_days=$5, car_price=$6, \
         hotel_price_per_room_night=$7, pickup_price=$8, persons_per_room=$9, vehicle_id=$10, hotel_name=$11, \
         cover_image=$12, includes=$13, active=$14 WHERE id=$15 RETURNING {COLS}"
    ))
    .bind(&slug).bind(b.title.trim()).bind(b.category.trim()).bind(b.summary.trim()).bind(b.duration_days)
    .bind(b.car_price).bind(b.hotel_price_per_room_night).bind(b.pickup_price).bind(b.persons_per_room)
    .bind(b.vehicle_id).bind(&b.hotel_name).bind(&b.cover_image).bind(&b.includes).bind(b.active)
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;
    save_items(&mut tx, id, &b.items).await?;
    tx.commit().await?;
    audit(
        &s.db,
        staff.id,
        "update",
        "package",
        Some(id),
        json!({
            "title": p.title,
            "car_price": [before.car_price, p.car_price],
            "hotel_price_per_room_night": [before.hotel_price_per_room_night, p.hotel_price_per_room_night],
            "pickup_price": [before.pickup_price, p.pickup_price],
        }),
    )
    .await;
    Ok(Json(detail(&s.db, p).await?))
}

fn two() -> i32 {
    2
}

// ---------- pricing ----------

/// How a package price is built. Everything here is computed on the server.
#[derive(Serialize, Debug, PartialEq)]
pub struct PackageQuote {
    pub people: i32,
    pub cars: i32,
    pub car_price: i64,
    pub car_total: i64,
    pub hotel: bool,
    pub rooms: i32,
    pub nights: i32,
    pub hotel_price_per_room_night: i64,
    pub hotel_total: i64,
    pub pickup: bool,
    pub pickup_total: i64,
    pub total: i64,
}

fn ceil_div(a: i32, b: i32) -> i32 {
    (a + b - 1) / b
}

/// total = cars x car price  +  (rooms x nights x room rate, if hotel wanted)  +  (pickup charge, if wanted)
/// `seats` is the seat count of the package vehicle; cars = ceil(people / seats).
pub fn compute_package_quote(
    p: &Package,
    seats: i32,
    people: i32,
    hotel: bool,
    pickup: bool,
) -> AppResult<PackageQuote> {
    if !(1..=100).contains(&people) {
        return bad("Number of people must be between 1 and 100");
    }
    let cars = ceil_div(people, seats.max(1));
    let car_total = cars as i64 * p.car_price;

    let nights = p.duration_days - 1;
    let (mut rooms, mut hotel_total) = (0, 0);
    if hotel {
        if p.hotel_price_per_room_night == 0 {
            return bad("A hotel stay is not offered with this package");
        }
        if nights < 1 {
            return bad("This package has no overnight stay");
        }
        rooms = ceil_div(people, p.persons_per_room.max(1));
        hotel_total = rooms as i64 * nights as i64 * p.hotel_price_per_room_night;
    }
    let pickup_total = if pickup { p.pickup_price } else { 0 };

    Ok(PackageQuote {
        people,
        cars,
        car_price: p.car_price,
        car_total,
        hotel,
        rooms,
        nights: if hotel { nights } else { 0 },
        hotel_price_per_room_night: p.hotel_price_per_room_night,
        hotel_total,
        pickup,
        pickup_total,
        total: car_total + hotel_total + pickup_total,
    })
}

/// Seats of the package's vehicle (needed to work out how many cars a group needs).
pub async fn package_seats(db: &PgPool, p: &Package) -> AppResult<i32> {
    let v = p
        .vehicle_id
        .ok_or_else(|| AppError::BadRequest("This package has no vehicle set".into()))?;
    Ok(
        sqlx::query_scalar("SELECT seats FROM vehicles WHERE id = $1")
            .bind(v)
            .fetch_one(db)
            .await?,
    )
}

#[derive(Deserialize)]
pub struct QuoteIn {
    package_id: Uuid,
    people: i32,
    #[serde(default)]
    hotel: bool,
    #[serde(default)]
    pickup: bool,
}

pub async fn quote(
    State(s): State<AppState>,
    Json(b): Json<QuoteIn>,
) -> AppResult<Json<PackageQuote>> {
    let p = fetch_package(&s.db, b.package_id).await?;
    if !p.active {
        return Err(AppError::NotFound);
    }
    let seats = package_seats(&s.db, &p).await?;
    Ok(Json(compute_package_quote(
        &p, seats, b.people, b.hotel, b.pickup,
    )?))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pkg() -> Package {
        Package {
            id: Uuid::nil(),
            slug: "x".into(),
            title: "x".into(),
            category: "Family".into(),
            summary: "x".into(),
            duration_days: 3,
            car_price: 9000,
            hotel_price_per_room_night: 3000,
            pickup_price: 500,
            persons_per_room: 2,
            vehicle_id: None,
            hotel_name: None,
            cover_image: None,
            includes: vec![],
            active: true,
        }
    }

    #[test]
    fn car_only() {
        let q = compute_package_quote(&pkg(), 7, 5, false, false).unwrap();
        assert_eq!((q.cars, q.total), (1, 9000));
    }

    #[test]
    fn eight_people_need_two_taveras() {
        let q = compute_package_quote(&pkg(), 7, 8, false, false).unwrap();
        assert_eq!((q.cars, q.car_total), (2, 18000));
    }

    #[test]
    fn hotel_and_pickup_add_up() {
        // 5 people -> 3 rooms x 2 nights x 3000 = 18000; 1 car = 9000; pickup 500
        let q = compute_package_quote(&pkg(), 7, 5, true, true).unwrap();
        assert_eq!(
            (q.rooms, q.nights, q.hotel_total, q.pickup_total),
            (3, 2, 18000, 500)
        );
        assert_eq!(q.total, 9000 + 18000 + 500);
    }

    #[test]
    fn rejects_unavailable_or_invalid() {
        let mut p = pkg();
        assert!(compute_package_quote(&p, 7, 0, false, false).is_err());
        assert!(compute_package_quote(&p, 7, 101, false, false).is_err());
        p.hotel_price_per_room_night = 0;
        assert!(compute_package_quote(&p, 7, 2, true, false).is_err());
        p.hotel_price_per_room_night = 3000;
        p.duration_days = 1; // day trip: no night to stay
        assert!(compute_package_quote(&p, 7, 2, true, false).is_err());
    }
}
