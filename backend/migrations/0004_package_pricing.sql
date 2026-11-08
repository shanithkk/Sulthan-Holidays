-- Package price is no longer "per person". It is built from:
--   car (per car, whole trip)  +  hotel (optional, per room per night)  +  pickup (optional, fixed)
-- The number of cars and rooms follows the group size. PRICES BELOW ARE PLACEHOLDERS: edit in the admin panel.

ALTER TABLE packages
    ADD COLUMN car_price                  BIGINT NOT NULL DEFAULT 0 CHECK (car_price >= 0),
    ADD COLUMN hotel_price_per_room_night BIGINT NOT NULL DEFAULT 0 CHECK (hotel_price_per_room_night >= 0),
    ADD COLUMN pickup_price               BIGINT NOT NULL DEFAULT 0 CHECK (pickup_price >= 0),
    ADD COLUMN persons_per_room           INT    NOT NULL DEFAULT 2 CHECK (persons_per_room >= 1);

UPDATE packages SET car_price = 6000,  hotel_price_per_room_night = 1500, pickup_price = 500 WHERE slug = '2-days-wayanad';
UPDATE packages SET car_price = 9000,  hotel_price_per_room_night = 3000, pickup_price = 500 WHERE slug = 'wayanad-honeymoon';
UPDATE packages SET car_price = 12000, hotel_price_per_room_night = 1200, pickup_price = 800 WHERE slug = 'wayanad-adventure';

-- Any other package keeps its old total as a starting car price so nothing shows as free.
UPDATE packages SET car_price = price_per_person * 2 WHERE car_price = 0 AND price_per_person > 0;
ALTER TABLE packages DROP COLUMN price_per_person;

UPDATE packages SET cover_image = '/images/places/pookode.jpg' WHERE slug = '2-days-wayanad'    AND cover_image IS NULL;
UPDATE packages SET cover_image = '/images/places/tea.jpg'     WHERE slug = 'wayanad-honeymoon'  AND cover_image IS NULL;
UPDATE packages SET cover_image = '/images/places/chembra.jpg' WHERE slug = 'wayanad-adventure'  AND cover_image IS NULL;

-- Tavera is a 7-seater (and a Chevrolet, not a Toyota).
UPDATE vehicles SET seats = 7, name = 'Chevrolet Tavera (7 seater)',
       description = 'Comfortable on hill roads. Seats up to 7 passengers.'
 WHERE vehicle_type = 'tavera' AND name LIKE 'Toyota Tavera%';

UPDATE vehicles SET photo_url = '/images/vehicles/traveller.jpg' WHERE vehicle_type = 'traveller' AND photo_url IS NULL;
UPDATE vehicles SET photo_url = '/images/vehicles/tavera.jpg'    WHERE vehicle_type = 'tavera'    AND photo_url IS NULL;
UPDATE vehicles SET photo_url = '/images/vehicles/auto.jpg'      WHERE vehicle_type = 'auto'      AND photo_url IS NULL;

-- What the customer asked for and how the price was built (kept even if rates change later).
ALTER TABLE bookings
    ADD COLUMN hotel            BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN pickup           BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN pickup_location  TEXT,
    ADD COLUMN price_breakdown  JSONB;
