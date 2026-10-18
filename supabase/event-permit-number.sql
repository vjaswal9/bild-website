-- ============================================================
-- DET event permit number on each event
--
-- The number from the Dubai Department of Economy and Tourism event
-- permit (e-Permit) for an event. Typed into the event's details in the
-- admin, and shown on the public event page once filled in.
--
-- Optional and safe to run more than once. Until this has been run the
-- admin still saves events normally; only the permit number itself is
-- skipped, with a message saying so.
-- ============================================================
alter table public.events
  add column if not exists permit_number text;
