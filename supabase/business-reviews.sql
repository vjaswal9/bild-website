-- Lets members leave a star rating + written review against a specific BILD
-- business, reusing the existing testimonials table (and therefore the existing
-- admin approve/reject moderation flow) rather than duplicating it.
--
-- business_id NULL  = a testimonial about BILD itself (all existing rows).
-- business_id set   = a review of that directory business.
--
-- Run this in the Supabase SQL editor.

ALTER TABLE testimonials
  ADD COLUMN IF NOT EXISTS business_id uuid NULL
  REFERENCES business_submissions(id) ON DELETE CASCADE;

-- The business profile page filters by business_id + status on every view.
CREATE INDEX IF NOT EXISTS testimonials_business_id_idx
  ON testimonials (business_id, status);
