-- Directory: every listing is free until the end of 31 December 2026.
--
-- The website code already gives this date to every business approved from now
-- on (LISTING_GRACE_CUTOFF in src/lib/featured-copy.ts). This file brings the
-- businesses ALREADY in the system up to the same date. Run it in the Supabase
-- SQL Editor, one block at a time. Nothing here deletes anything.
--
-- Not touched: permanently comped listings (listing_fee_exempt), paused or
-- delisted listings, listings that have already lapsed, and listings that are
-- already paid beyond 31 December 2026. Featured (paid) is not changed.

-- ---------------------------------------------------------------------------
-- 1. PREVIEW: live listings that would otherwise end before 31 December 2026.
--    Includes the members who were given "free until 31 October 2026".
-- ---------------------------------------------------------------------------
select business_name, is_bild_member, listing_paid_until
from business_submissions
where status = 'approved'
  and delisted_at is null
  and coalesce(listing_fee_exempt, false) = false
  and listing_paid_until >= now()
  and listing_paid_until < '2026-12-31T23:59:59+04:00'
order by listing_paid_until;

-- ---------------------------------------------------------------------------
-- 2. EXTEND those listings to the end of 31 December 2026, and reset the
--    "renewal reminder already sent" markers so the reminders before the new
--    date go out normally.
-- ---------------------------------------------------------------------------
update business_submissions
set listing_paid_until = '2026-12-31T23:59:59+04:00',
    listing_renewal_reminder_sent_at = null,
    listing_final_reminder_sent_at = null
where status = 'approved'
  and delisted_at is null
  and coalesce(listing_fee_exempt, false) = false
  and listing_paid_until >= now()
  and listing_paid_until < '2026-12-31T23:59:59+04:00';

-- ---------------------------------------------------------------------------
-- 3. OPTIONAL: approved businesses that were asked to pay and have not (listed
--    here first). Run the update only if you want them live and free now. They
--    are not emailed; tell them yourself if you wish.
-- ---------------------------------------------------------------------------
select business_name, is_bild_member, listing_payment_token_expires_at
from business_submissions
where status = 'approved'
  and delisted_at is null
  and coalesce(listing_fee_exempt, false) = false
  and listing_paid_until is null
  and listing_payment_token is not null;

-- update business_submissions
-- set listing_paid_until = '2026-12-31T23:59:59+04:00',
--     listing_payment_token = null,
--     listing_payment_token_expires_at = null
-- where status = 'approved'
--   and delisted_at is null
--   and coalesce(listing_fee_exempt, false) = false
--   and listing_paid_until is null
--   and listing_payment_token is not null;
