-- The business owner's own BILD membership start date, entered at
-- submission time (YYYY-MM). Distinct from created_at, which only reflects
-- when the business listing itself was submitted to the directory.
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS bild_member_since text;
