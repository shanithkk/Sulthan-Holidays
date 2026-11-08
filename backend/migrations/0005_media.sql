-- Photos uploaded from the admin panel (vehicle and package pictures).
-- Stored in Postgres so they survive restarts and need no extra storage service.
-- Move to object storage (S3/R2) later by changing only backend/src/media.rs.
CREATE TABLE media (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    filename     TEXT,
    data         BYTEA NOT NULL,
    created_by   UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
