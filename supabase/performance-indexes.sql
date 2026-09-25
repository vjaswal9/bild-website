-- Indexes for the queries that sit on a paying customer's path.
--
-- Safe to run more than once: every statement is "if not exists", and none of
-- them change data. CONCURRENTLY is deliberately not used so this can be
-- pasted straight into the Supabase SQL editor, which runs inside a
-- transaction. The tables are small enough that the brief lock is unnoticeable.

-- 1. Capacity checks.
--    Every ticket sale runs .eq('event_id', …).eq('status', 'paid') at least
--    twice: once at checkout and once again in the webhook after payment, with
--    the second one deciding whether a sale has oversold the event. Only
--    event_id was indexed, so each of those filtered the matching rows for
--    status in memory.
create index if not exists event_registrations_event_status_idx
  on public.event_registrations (event_id, status);

-- 2. Refunds arriving from Stripe.
--    The webhook now handles refunds and chargebacks raised in the Stripe
--    dashboard, and finds the payment they belong to by charge id. Without
--    this that lookup scans the whole payments table on every refund.
create index if not exists payments_stripe_charge_id_idx
  on public.payments (stripe_charge_id);

-- 3. The directory.
--    business_submissions carries no index at all in any checked-in migration,
--    yet it is looked up by slug on every profile page view and by four
--    separate token columns on the payment and management links that go out
--    in emails. Those are all single-row lookups on a table that is only going
--    to grow.
create index if not exists business_submissions_slug_idx
  on public.business_submissions (slug);

create index if not exists business_submissions_status_idx
  on public.business_submissions (status);

-- Partial indexes: the token columns are null for almost every row, so only
-- the rows that actually hold a live token are worth indexing.
create index if not exists business_submissions_listing_token_idx
  on public.business_submissions (listing_payment_token)
  where listing_payment_token is not null;

create index if not exists business_submissions_featured_token_idx
  on public.business_submissions (featured_payment_token)
  where featured_payment_token is not null;

create index if not exists business_submissions_manage_token_idx
  on public.business_submissions (featured_manage_token)
  where featured_manage_token is not null;

create index if not exists business_submissions_renewal_token_idx
  on public.business_submissions (renewal_token)
  where renewal_token is not null;

-- 4. Members.
--    Looked up by email on the join flow and by status on every directory
--    submission (to check a claimed BILD membership).
create index if not exists members_email_idx  on public.members (email);
create index if not exists members_status_idx on public.members (status);
