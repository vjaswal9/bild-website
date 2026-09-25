-- Contact details for whoever left a review, captured so admins can verify the
-- reviewer is a real person before approving. ADMIN-ONLY: these columns must
-- never be selected by any public-facing query - see the explicit column lists
-- in src/components/directory/BusinessReviews.tsx and src/lib/reviews.ts.
--
-- Run this in the Supabase SQL editor.

ALTER TABLE testimonials
  ADD COLUMN IF NOT EXISTS reviewer_email text NULL,
  ADD COLUMN IF NOT EXISTS reviewer_phone text NULL;
