-- "Our travellers": past trips of the team/customers with photos and feedback, all added by staff.
-- Nothing is seeded on purpose: testimonials must be real.
CREATE TABLE trips (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,                 -- e.g. "Family trip from Kochi"
    label       TEXT NOT NULL DEFAULT '',      -- badge on the tile, e.g. "1 Day Trip", "3 Day Trip"
    description TEXT NOT NULL DEFAULT '',
    trip_date   DATE,
    sort_order  INT NOT NULL DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE trip_photos (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    caption    TEXT,
    sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX trip_photos_trip_idx ON trip_photos(trip_id, sort_order);
CREATE TABLE trip_feedback (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    author     TEXT,                           -- name as the guest wants it shown, e.g. "Anil, Kochi"
    body       TEXT NOT NULL,
    rating     INT CHECK (rating BETWEEN 1 AND 5),
    sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX trip_feedback_trip_idx ON trip_feedback(trip_id, sort_order);
