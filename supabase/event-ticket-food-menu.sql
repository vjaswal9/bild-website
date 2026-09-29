-- A second, independent menu attachment per ticket. The existing
-- menu_image_url column is kept as-is (renaming it would touch every query
-- and email that reads it for zero benefit - only its on-screen label
-- changes, to "Drinks Menu") and this adds its "Food Menu" counterpart
-- alongside it. Either, both, or neither can be set per ticket.
--
-- Run this in the Supabase SQL editor.

alter table public.event_tickets
  add column if not exists food_menu_image_url text;
