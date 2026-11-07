-- ============================================================
-- Event cash flow
--
-- Profit answers "did the event make money?". Cash flow answers "when does
-- the money actually move?". This adds only what cash flow needs, and leaves
-- every profit figure exactly as it is.
--
-- 1. `settled` on costs and on hand-typed revenue lines: true = the money has
--    been paid / received, false = still to pay / still to receive. Every
--    existing line defaults to true, so nothing existing changes meaning.
-- 2. `event_venue_payments`: what is paid (or scheduled) towards the hotel or
--    venue bill that the ticket cost prices already add up to. These are NOT
--    extra costs and never feed the profit figures or the Money dashboard.
--
-- Safe to run more than once.
-- ============================================================

alter table public.operating_costs
  add column if not exists settled boolean not null default true;

alter table public.payments
  add column if not exists settled boolean not null default true;

create table if not exists public.event_venue_payments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event_id    uuid not null references public.events(id) on delete cascade,
  due_on      date not null,
  description text not null,
  amount_aed  numeric(12,2) not null check (amount_aed > 0),
  settled     boolean not null default false
);

create index if not exists event_venue_payments_event_idx
  on public.event_venue_payments(event_id);

-- Admin only, like the other money tables: locked to the public anon key,
-- every read and write happens server-side with the service-role key.
alter table public.event_venue_payments enable row level security;
