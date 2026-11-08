-- Sulthan Holidays MVP schema. Money is stored as whole rupees (BIGINT).

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    phone         TEXT,                 -- +91XXXXXXXXXX; required before booking
    password_hash TEXT,                 -- NULL for Google-only accounts
    google_sub    TEXT UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE staff (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vehicles (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT NOT NULL,
    vehicle_type     TEXT NOT NULL CHECK (vehicle_type IN ('traveller', 'tavera', 'auto')),
    seats            INT NOT NULL CHECK (seats > 0),
    ac               BOOLEAN NOT NULL DEFAULT FALSE,
    photo_url        TEXT,
    description      TEXT,
    rate_per_km      BIGINT NOT NULL CHECK (rate_per_km >= 0),
    rate_per_day     BIGINT NOT NULL CHECK (rate_per_day >= 0),
    min_km           INT NOT NULL DEFAULT 0 CHECK (min_km >= 0),   -- per day
    driver_allowance BIGINT NOT NULL DEFAULT 0,                    -- per day
    night_charge     BIGINT NOT NULL DEFAULT 0,                    -- per night
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE packages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug             TEXT NOT NULL UNIQUE,
    title            TEXT NOT NULL,
    category         TEXT NOT NULL,          -- Family, Honeymoon, Adventure ...
    summary          TEXT NOT NULL,
    duration_days    INT NOT NULL CHECK (duration_days > 0),
    price_per_person BIGINT NOT NULL CHECK (price_per_person >= 0),
    vehicle_id       UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    hotel_name       TEXT,
    cover_image      TEXT,
    includes         TEXT[] NOT NULL DEFAULT '{}',
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE package_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id  UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    day_number  INT NOT NULL CHECK (day_number > 0),
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    places      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX package_items_package_idx ON package_items(package_id, day_number);

CREATE TABLE enquiries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    email       TEXT,
    package_id  UUID REFERENCES packages(id) ON DELETE SET NULL,
    vehicle_id  UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    travel_date DATE,
    people      INT NOT NULL DEFAULT 1 CHECK (people > 0),
    message     TEXT,
    status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference      TEXT NOT NULL UNIQUE,
    user_id        UUID NOT NULL REFERENCES users(id),
    kind           TEXT NOT NULL CHECK (kind IN ('package', 'vehicle')),
    package_id     UUID REFERENCES packages(id),
    vehicle_id     UUID REFERENCES vehicles(id),
    travel_date    DATE NOT NULL,
    end_date       DATE NOT NULL,
    people         INT NOT NULL DEFAULT 1 CHECK (people > 0),
    km             INT,
    amount         BIGINT NOT NULL CHECK (amount >= 0),   -- total fare, computed on the server
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'submitted', 'paid', 'refunded')),
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((kind = 'package' AND package_id IS NOT NULL) OR (kind = 'vehicle' AND vehicle_id IS NOT NULL))
);
CREATE INDEX bookings_user_idx ON bookings(user_id, created_at DESC);

-- Payment models. MVP uses method 'upi_qr' (customer scans QR, admin confirms).
-- 'razorpay' columns are ready for the later online-payment phase.
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id          UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    method              TEXT NOT NULL DEFAULT 'upi_qr' CHECK (method IN ('upi_qr', 'razorpay')),
    amount              BIGINT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'paid', 'failed', 'refunded')),
    customer_reference  TEXT,              -- UPI transaction id (UTR) typed by customer
    provider_order_id   TEXT,              -- Razorpay order id (later)
    provider_payment_id TEXT,              -- Razorpay payment id (later)
    provider_signature  TEXT,              -- Razorpay signature (later)
    paid_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_booking_idx ON payments(booking_id);

CREATE TABLE refunds (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id         UUID NOT NULL REFERENCES payments(id),
    amount             BIGINT NOT NULL CHECK (amount > 0),
    reason             TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('pending', 'processed', 'failed')),
    provider_refund_id TEXT,
    created_by         UUID REFERENCES staff(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id   UUID REFERENCES staff(id),
    action     TEXT NOT NULL,
    entity     TEXT NOT NULL,
    entity_id  UUID,
    details    JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at DESC);
