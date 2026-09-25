-- Stage 2: stop the public key being able to write into storage.
--
-- WHAT WAS WRONG
-- Four policies granted INSERT on storage.objects to the anon role:
--
--   public_upload_license   anon INSERT   business-licenses
--   public_upload_logo      anon INSERT   business-logos
--   event flyers upload     anon INSERT   event-flyers
--   event media upload      anon INSERT   event-media
--
-- The anon key is published in the JavaScript of every page, so these were
-- open to anyone: files of any size and any type, written into BILD's storage,
-- counting against BILD's quota, and served back from a Supabase URL. Nothing
-- constrained the filename either, so an upload could overwrite an existing
-- logo by reusing its name.
--
-- They existed because all ten upload points in the site uploaded straight
-- from the browser with the anon key, which needs an INSERT policy to work.
--
-- WHAT CHANGED FIRST
-- Uploads now go through /api/uploads/sign. The server decides whether the
-- caller is allowed (admin session, Featured manage token, document renewal
-- token, or the public directory submission, which is rate limited), and then
-- picks the bucket, the path and the file extension itself before handing back
-- a one-time signed token. The browser uploads with that token.
--
-- A signed upload is pre-authorised, so it does not consult these policies at
-- all. That is why they can now be dropped without breaking anything.
--
-- Verified on 2026-09-18 against the live site, before running this:
--   - signing returns a token for a permitted file
--   - a file type outside the allowlist is refused (400)
--   - an oversized file is refused (400)
--   - an admin-only kind is refused without an admin session (403)
--   - the full round trip works: signed upload 200, file served 200
--
-- The ten call sites now using it: the directory submission form (licence,
-- logo, banner), the licence renewal form, the Featured content form (gallery
-- photos and, already, the brochure), the admin business editor (logo,
-- banner), and the admin event screens (flyer, media).

drop policy if exists public_upload_license on storage.objects;
drop policy if exists public_upload_logo    on storage.objects;
drop policy if exists "event flyers upload" on storage.objects;
drop policy if exists "event media upload"  on storage.objects;

-- Left in place on purpose:
--
--   event assets read   anon+authenticated SELECT on event-flyers, event-media
--
-- Those two buckets are public buckets, so their contents are readable by URL
-- regardless. The policy grants nothing that is not already open, and event
-- flyers and photos are meant to be seen.

-- ---------------------------------------------------------------------------
-- VERIFY: only "event assets read" should remain.
select policyname, roles, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
-- ---------------------------------------------------------------------------
