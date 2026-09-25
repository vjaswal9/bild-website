-- ============================================================
-- Per-event additional revenue and costs
--
-- Sponsorship money, bar takings, DJ fees, lighting hire: things that
-- belong to an event but never pass through Stripe and are not a ticket
-- cost price. They are recorded against the event in the Manage panel and
-- feed straight into the Money dashboard.
--
-- No new tables are needed. Extra revenue is a manual row in `payments`
-- with an event_id, and extra costs are rows in `operating_costs` with an
-- event_id. Both already bubble up into the year totals and into per-event
-- profit.
-- ============================================================

-- 1. Whether the Manage panel shows the section at all. Answering "no"
--    hides it, which is why this is stored rather than inferred from
--    whether any lines exist: an event can be answered "yes" and still be
--    waiting for its first line item.
alter table public.events
  add column if not exists has_extra_finances boolean not null default false;

-- 2. Sponsorship becomes its own revenue stream, so it shows separately in
--    the dashboard rather than being lumped into "Other income".
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('membership', 'event_ticket', 'listing', 'featured', 'sponsorship', 'other'));
