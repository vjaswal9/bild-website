-- An optional menu image per ticket type, so a buyer can see what a package
-- actually includes (a dinner menu, a drinks list) before paying for it.
--
-- A link rather than an upload: admins already have these as images from a
-- venue and just need somewhere to paste the link.
--
-- Run this in the Supabase SQL editor.

alter table public.event_tickets
  add column if not exists menu_image_url text;
