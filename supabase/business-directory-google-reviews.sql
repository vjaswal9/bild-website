-- Per-business Google Reviews: google_maps_url is the raw link the business
-- pasted (kept for admin visibility/manual fixup); google_place_id is the
-- resolved ID actually used to fetch reviews.
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS google_maps_url text;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS google_place_id text;
