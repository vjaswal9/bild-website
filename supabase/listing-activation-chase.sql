-- Chasing businesses that were approved but never paid their listing fee.
--
-- WHY THIS EXISTS
-- An approved business is emailed a payment link that lasts seven days. If it
-- expired, nothing happened: the business could not pay (the payment page told
-- them to contact BILD), the listing stayed invisible, and no one was told.
-- Forward Air Cargo sat like that from 5 September and EMRYS from 19
-- September, both silently.
--
-- The daily cron now chases them: two days before the link expires it issues a
-- fresh seven-day link and emails it. If that second link also expires, the
-- business is archived as "Applied but never paid" and stops being chased.
--
-- Run this in the Supabase SQL editor.

alter table public.business_submissions
  -- When the one activation reminder was sent. Its presence is what marks a
  -- business as already having had its second chance, so it is chased once and
  -- not indefinitely.
  add column if not exists listing_activation_reminder_sent_at timestamptz,

  -- Set when the second link expires unpaid. The business keeps status
  -- 'approved' on purpose: it was approved, and rejecting it would confuse
  -- "we turned them down" with "they never paid", which are different facts
  -- and different numbers. This column is what moves them out of the working
  -- lists and into the archive tab.
  add column if not exists listing_abandoned_at timestamptz;

-- The daily sweep asks for approved, unpaid, not-exempt, not-yet-abandoned
-- businesses and sorts them by when their token expires.
create index if not exists business_submissions_activation_chase_idx
  on public.business_submissions (status, listing_abandoned_at, listing_payment_token_expires_at)
  where listing_paid_until is null;

-- ---------------------------------------------------------------------------
-- Backfill.
--
-- Deliberately does NOT archive the businesses already past their link expiry.
-- They never had the chance this system is built to give them, so archiving
-- them now would record them as having ignored a reminder they were never
-- sent. Leaving both columns null puts them at the start of the new cycle:
-- the next daily run reminds them with a fresh link, and only archives them if
-- they let that one lapse too.
-- ---------------------------------------------------------------------------

-- VERIFY: these are the businesses the first run will chase.
select business_name,
       listing_payment_token_expires_at,
       listing_activation_reminder_sent_at,
       listing_abandoned_at
from public.business_submissions
where status = 'approved'
  and listing_paid_until is null
  and listing_fee_exempt is not true
  and listing_abandoned_at is null;
