-- ============================================================
-- BILD: restaurant reservation events
-- Run this once in Supabase -> SQL Editor -> New query -> Run
--
-- Adds how people book an event:
--   'tickets'      paid online through the website (every existing event)
--   'reservation'  a booking at a restaurant that takes the payment itself:
--                  each booking is emailed to the restaurant, which sends
--                  the guest a payment link directly. Nothing is paid through
--                  the website and the word "ticket" is never shown to guests
--
-- Also adds restaurant_email: where each reservation is forwarded as it is
-- made (one address, or several separated by commas).
--
-- Every existing event becomes 'tickets', so nothing changes for them.
-- Safe to run more than once.
-- ============================================================

alter table public.events
  add column if not exists booking_mode text not null default 'tickets';

alter table public.events
  add column if not exists restaurant_email text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_booking_mode_check') then
    alter table public.events
      add constraint events_booking_mode_check check (booking_mode in ('tickets', 'reservation'));
  end if;
end $$;
