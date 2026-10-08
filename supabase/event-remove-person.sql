-- Remove one person from a booking (and refund their ticket).
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Additive only: three new columns on event_registrations, with defaults, so
-- every existing booking is untouched and reads exactly as before.
--
--   removed_people     who has been taken off this booking, what their ticket
--                      was worth, and what was refunded (an audit trail, and
--                      what keeps the event revenue figures right)
--   payer_first_name   set only when the person who PAID is the one removed:
--   payer_last_name    the booking then carries a guest's name as its lead, and
--                      these keep who actually paid, for refund emails and notes

alter table public.event_registrations
  add column if not exists removed_people jsonb not null default '[]'::jsonb,
  add column if not exists payer_first_name text,
  add column if not exists payer_last_name text;
