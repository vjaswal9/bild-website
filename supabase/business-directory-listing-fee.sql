-- Membership tier: captured on the submission form, drives pricing tier and
-- the "Non-BILD Business" badge. Defaults true so existing rows (all
-- submitted under the old members-only rule) need no backfill.
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS is_bild_member boolean NOT NULL DEFAULT true;

-- Base listing fee (150 AED/year members, 300 AED/year non-members)
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS listing_paid_until timestamptz;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS listing_payment_token text;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS listing_payment_token_expires_at timestamptz;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS listing_renewal_reminder_sent_at timestamptz;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS listing_final_reminder_sent_at timestamptz;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS listing_expired_notice_sent_at timestamptz;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS listing_fee_exempt boolean NOT NULL DEFAULT false;

-- Featured upgrade (500 AED/quarter members, 1,000 AED/quarter non-members).
-- The existing `featured` boolean and its free admin toggle are untouched;
-- these columns are purely additive for the paid path.
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS featured_paid_until timestamptz;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS featured_payment_token text;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS featured_payment_token_expires_at timestamptz;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS featured_renewal_reminder_sent_at timestamptz;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS featured_final_reminder_sent_at timestamptz;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS featured_expired_notice_sent_at timestamptz;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS featured_manage_token text;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS featured_bio text;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS featured_gallery_urls text[];
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS featured_video_url text;
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS featured_offers text[];
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS profile_view_count integer NOT NULL DEFAULT 0;

-- One-time backfill: every business already approved by the time this ships
-- gets a free ride until the cutover date, exactly like the plan's grace
-- period for members approved before then.
UPDATE business_submissions SET listing_paid_until = '2026-10-31' WHERE status = 'approved' AND listing_paid_until IS NULL;
