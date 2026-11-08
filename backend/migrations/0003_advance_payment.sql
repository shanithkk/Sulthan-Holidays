-- Customers pay an advance only AFTER staff confirm the booking.
-- advance_amount is set by staff at confirmation; the balance is collected later.
ALTER TABLE bookings ADD COLUMN advance_amount BIGINT CHECK (advance_amount IS NULL OR advance_amount >= 1);

-- Payments are now created at confirmation (for the advance), not at booking time.
-- Remove empty placeholder rows left by the earlier flow for bookings not yet confirmed.
DELETE FROM payments p USING bookings b
 WHERE p.booking_id = b.id AND b.status = 'pending' AND p.status = 'pending';
