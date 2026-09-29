-- Remembers which original table code an overflow code spun out of, so the
-- admin seating panel can show "this group overflowed from NQWVU - seat them
-- near that table" instead of two unrelated-looking groups.
--
-- Set once, on the founding booking of the new code, at the moment checkout
-- decides a code is too full to join. Never touched again after that.
--
-- Run this in the Supabase SQL editor.

alter table public.event_registrations
  add column if not exists overflow_from_code text;
