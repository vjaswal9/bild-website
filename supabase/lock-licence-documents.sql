-- Stop the public key being able to read businesses' trade licence documents.
--
-- WHAT WAS WRONG
-- storage.objects carried a policy named "admin_read_license":
--
--   admin_read_license   PERMISSIVE   {anon}   SELECT
--   using (bucket_id = 'business-licenses')
--
-- The name says admin. The role says anon, which is every visitor, because the
-- anon key is published in the JavaScript of every page on the site. It very
-- likely looked correct when it was written, because the admin dashboard was
-- signing document URLs in the browser with that same anon key, so the policy
-- was genuinely needed for admin review to work.
--
-- The effect was that anyone who read the site's JavaScript could list the
-- business-licenses bucket and download every document in it. Verified on
-- 2026-09-18: listing returned objects, and a ranged GET for a real document
-- returned HTTP 206 using only the public key. The bucket is private, so the
-- documents are not exposed to someone with no key at all, but that is a thin
-- defence when the key is in plain sight.
--
-- WHY IT IS NOW SAFE TO DROP
-- Document signing moved to the server in /api/admin/business/document-url,
-- which checks the admin session, confirms the path belongs to a real listing,
-- and signs with the service-role key. Service role bypasses storage policies,
-- so admin review is unaffected. Nothing else reads this bucket: the
-- submission and renewal forms only upload to it.

drop policy if exists admin_read_license on storage.objects;

-- Deliberately NOT dropped here, because the browser still uploads directly to
-- these buckets and dropping them would break the directory submission form,
-- the licence renewal form, the Featured content form and the admin event
-- screens:
--
--   public_upload_license   anon INSERT   business-licenses
--   public_upload_logo      anon INSERT   business-logos
--   event flyers upload     anon INSERT   event-flyers
--   event media upload      anon INSERT   event-media
--
-- Those allow writing, not reading, so they are a storage-abuse and
-- content-hosting problem rather than a data leak. Closing them means moving
-- all ten upload call sites onto server-issued signed upload URLs, the pattern
-- already used by /api/business/featured-brochure. That is the next piece of
-- work, not this one.

-- ---------------------------------------------------------------------------
-- VERIFY: should list no SELECT policy for business-licenses.
select policyname, roles, cmd, qual
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
-- ---------------------------------------------------------------------------
