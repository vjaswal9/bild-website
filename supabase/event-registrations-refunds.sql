-- Lets an admin mark a paid event ticket as refunded. status can now also
-- be 'refunded' (in addition to the existing 'pending' | 'paid') - refunded
-- registrations are excluded from ticket counts, the door list export, and
-- the Event Financials export, but stay in the table for the record.
alter table public.event_registrations add column if not exists refunded_at timestamptz;
