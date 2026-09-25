-- Generalizes the license-tracking system to support both UAE and UK
-- registered businesses. Column renames are metadata-only in Postgres, so
-- existing UAE businesses' data is preserved automatically. Run this in the
-- Supabase SQL editor.

ALTER TABLE business_submissions RENAME COLUMN license_url TO document_url;
ALTER TABLE business_submissions RENAME COLUMN license_expiry_date TO document_expiry_date;
ALTER TABLE business_submissions RENAME COLUMN expiry_reminder_sent_at TO document_reminder_sent_at;
ALTER TABLE business_submissions RENAME COLUMN pending_license_url TO pending_document_url;
ALTER TABLE business_submissions RENAME COLUMN pending_license_expiry_date TO pending_document_expiry_date;

ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS business_country text NOT NULL DEFAULT 'UAE';
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS business_submissions_slug_idx
  ON business_submissions (slug) WHERE slug IS NOT NULL;
