-- Floor plan layout for events with table seating.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Purely additive: two new, empty (null) columns on events. Nothing existing
-- is changed, no rows are rewritten, and every current event keeps behaving
-- exactly as it does today. The floor plan view only appears for an event once
-- these columns exist and the event has table seating switched on.

alter table public.events
  add column if not exists seating_layout jsonb,
  add column if not exists seating_layout_updated_at timestamptz;
