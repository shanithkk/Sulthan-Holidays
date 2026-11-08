-- advance_amount: NULL = not confirmed yet, 0 = confirmed with NO advance, >= 1 = advance to pay.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_advance_amount_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_advance_amount_check CHECK (advance_amount IS NULL OR advance_amount >= 0);
