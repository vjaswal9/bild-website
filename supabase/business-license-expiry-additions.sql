-- License expiry tracking + self-service renewal workflow for the business directory.
-- Run this in the Supabase SQL editor. Safe to re-run (all IF NOT EXISTS).

ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS license_expiry_date date NULL;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS delisted_at timestamptz NULL;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS delisted_reason text NULL;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at timestamptz NULL;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS renewal_token text NULL;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS renewal_token_expires_at timestamptz NULL;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS pending_license_url text NULL;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS pending_license_expiry_date date NULL;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS pending_renewal_submitted_at timestamptz NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_submissions_renewal_token_idx
  ON business_submissions (renewal_token) WHERE renewal_token IS NOT NULL;
