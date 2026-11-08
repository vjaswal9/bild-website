-- ============================================================
-- BILD: record the actual payments made towards an event cost
-- Run this once in Supabase -> SQL Editor -> New query -> Run
--
-- A cost in Additional revenue & costs has one amount and one date. Some are
-- paid in two or more instalments, on different days. This table holds each
-- real payment (date it left the account and how much) so the event's Cash
-- flow view can show them on the day they happened.
--
-- It changes nothing about profit: the cost itself still counts once, for its
-- full amount, exactly as before. These rows only say when the money moved.
--
-- Safe to run more than once.
-- ============================================================

create table if not exists public.event_cost_payments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event_id    uuid not null references public.events(id) on delete cascade,
  cost_id     uuid not null references public.operating_costs(id) on delete cascade,
  paid_on     date not null,
  amount_aed  numeric(12,2) not null check (amount_aed > 0)
);

create index if not exists event_cost_payments_event_idx on public.event_cost_payments(event_id);
create index if not exists event_cost_payments_cost_idx  on public.event_cost_payments(cost_id);

-- Admin only, like the other money tables: locked to the public anon key,
-- every read and write happens server-side with the service-role key.
alter table public.event_cost_payments enable row level security;
