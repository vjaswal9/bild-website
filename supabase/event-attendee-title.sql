-- An optional title (Mr./Mrs./Miss) for the lead booker on an event ticket.
--
-- Guest titles need no migration - guest_names is jsonb, so a guest's title is
-- simply a new key inside the objects already stored there.
--
-- Run this in the Supabase SQL editor.

alter table public.event_registrations
  add column if not exists title text;
