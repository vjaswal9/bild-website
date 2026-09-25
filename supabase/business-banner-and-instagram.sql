-- Visual upgrade for business profile pages.
--
-- banner_url:          wide hero image across the top of the profile. Optional -
--                      pages without one fall back to a generated branded band
--                      built from the business's logo and palette colour, so a
--                      listing never looks empty.
-- instagram_post_url:  a single Instagram POST permalink to embed on the profile.
--                      Note this is NOT the same as the existing `instagram`
--                      column, which holds a handle. Instagram cannot embed a
--                      profile feed - only an individual post - so this has to
--                      be a specific post link.
--
-- Run this in the Supabase SQL editor.

ALTER TABLE business_submissions
  ADD COLUMN IF NOT EXISTS banner_url text NULL,
  ADD COLUMN IF NOT EXISTS instagram_post_url text NULL;
