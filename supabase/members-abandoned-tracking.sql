-- Tracks join applicants who started checkout but never completed payment
-- (Stripe Checkout Session expired unused). Run this in the Supabase SQL editor.

ALTER TABLE members ADD COLUMN IF NOT EXISTS abandoned_at timestamptz NULL;
