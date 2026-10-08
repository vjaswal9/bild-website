-- Fixes the double-count when a ticket is downgraded and the difference refunded.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- 1. A new column remembers how much ticket value each booking gave up through
--    downgrades, so the per-event revenue figures can add it back. Additive:
--    every booking gets 0 and reads exactly as before.
-- 2. The column is filled in for downgrades that already happened, read from the
--    notes "Change tickets" wrote on each booking ("tickets changed, 717 AED to
--    628 AED"). Only bookings still at 0 are touched, so re-running changes
--    nothing.
-- 3. The Money ledger row of the one downgrade so far (Lads Evening Brunch,
--    11 Sept: sold at 717, downgraded to 628, 89 refunded) had its revenue
--    lowered to 628 as well as the 89 refund, which took the drop off twice.
--    This puts the revenue back to 717. It only matches that exact row, and only
--    while it still shows 628 and 89.

alter table public.event_registrations
  add column if not exists downgrade_value_aed numeric not null default 0;

update public.event_registrations r
   set downgrade_value_aed = sub.given_up
  from (
    select e.id,
           sum(greatest(0, m[1]::numeric - m[2]::numeric)) as given_up
      from public.event_registrations e,
           lateral regexp_matches(e.admin_note, 'tickets changed, ([0-9]+(?:\.[0-9]+)?) AED to ([0-9]+(?:\.[0-9]+)?) AED', 'g') as m
     where e.admin_note is not null
     group by e.id
  ) sub
 where r.id = sub.id
   and r.downgrade_value_aed = 0
   and sub.given_up > 0;

update public.payments
   set revenue_aed = 717
 where id = '74edde51-fa3c-4925-b6d4-020fd1dba398'
   and revenue_aed = 628
   and refunded_aed = 89;
