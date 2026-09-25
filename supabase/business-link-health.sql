-- ============================================================
-- WEEKLY LINK CHECK
--
-- A paid listing that sends people to a dead website reflects on the
-- directory, not just on the business. These columns record what the
-- weekly check found, so a broken link is visible in the admin area
-- instead of being discovered by a member.
-- ============================================================

-- When the website was last checked.
alter table public.business_submissions
  add column if not exists website_checked_at timestamptz;

-- The HTTP status the site returned. 0 means it could not be reached at
-- all: no DNS, refused connection, or a timeout.
alter table public.business_submissions
  add column if not exists website_status integer;

-- Consecutive failed checks. A single bad week is usually the site being
-- restarted or a slow host, so nothing is flagged until this reaches 2.
-- Reset to zero the moment a check succeeds.
alter table public.business_submissions
  add column if not exists website_fail_count integer not null default 0;

-- Short human-readable reason, shown in the admin list ("HTTP 500",
-- "Timed out", "Domain not found").
alter table public.business_submissions
  add column if not exists website_error text;

create index if not exists business_website_fail_idx
  on public.business_submissions(website_fail_count);
