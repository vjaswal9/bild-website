-- Waiting list: which ticket types people want.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Additive only: one new nullable column on event_waitlist. Every entry made
-- before this is left exactly as it is (the column stays empty for them and
-- they keep showing just their ticket count). New entries fill it in with the
-- ticket types asked for, for example
--   [{"ticket_id":"...","ticket_name":"Dinner + drinks","quantity":2},
--    {"ticket_id":"...","ticket_name":"Soft drinks","quantity":1}]
-- tickets_wanted still holds the total, so every existing count keeps working.

alter table public.event_waitlist
  add column if not exists ticket_preferences jsonb;
