-- ============================================================
-- MONEY DASHBOARD
-- Two tables that make a year-by-year P&L possible.
--
-- Why a ledger is needed: before this, a membership payment left an
-- `amount` on the member row, an event ticket left `amount_aed` on the
-- registration, and a directory listing or Featured payment left NOTHING
-- but a "paid until" date. There was no record of what was actually
-- charged, when, or what Stripe took. This table records every payment
-- once, in one place, with the real Stripe fee from the balance
-- transaction rather than an estimate.
-- ============================================================

-- 1. PAYMENT LEDGER -----------------------------------------
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),

  -- When the money was actually taken. This is what the dashboard buckets
  -- by year and month, never created_at (a backfilled row is written today
  -- but may belong to a payment made months ago).
  paid_at            timestamptz not null,

  kind               text not null check (kind in ('membership', 'event_ticket', 'listing', 'featured', 'other')),
  description        text,

  -- What this payment relates to: a member, a registration, or a business.
  reference_id       uuid,
  -- Denormalised so per-event profit does not need a second lookup.
  event_id           uuid references public.events(id) on delete set null,

  -- gross_aed      = what the customer was actually charged.
  -- revenue_aed    = BILD's income, excluding any card fee passed on.
  -- fee_passed_on  = the card processing surcharge the customer paid.
  --                  gross_aed = revenue_aed + fee_passed_on_aed.
  -- stripe_fee_aed = what Stripe actually deducted (from the balance
  --                  transaction), so international and FX surcharges are
  --                  included rather than assumed.
  gross_aed          numeric(12,2) not null default 0,
  revenue_aed        numeric(12,2) not null default 0,
  fee_passed_on_aed  numeric(12,2) not null default 0,
  stripe_fee_aed     numeric(12,2) not null default 0,
  refunded_aed       numeric(12,2) not null default 0,

  currency           text not null default 'aed',
  stripe_session_id  text unique,
  stripe_charge_id   text,

  -- webhook = written live at the time of payment.
  -- backfill = reconstructed from the Stripe API afterwards.
  -- manual   = entered by an admin (e.g. cash or bank transfer).
  source             text not null default 'webhook'
);

create index if not exists payments_paid_at_idx    on public.payments(paid_at);
create index if not exists payments_kind_idx       on public.payments(kind);
create index if not exists payments_event_id_idx   on public.payments(event_id);
create index if not exists payments_reference_idx  on public.payments(reference_id);

-- 2. OPERATING COSTS ----------------------------------------
-- Everything BILD spends that Stripe and ticket cost prices do not already
-- capture: trade licence, venue deposits, decor, photography, software,
-- marketing. Optionally attributed to an event so per-event profit is real.
create table if not exists public.operating_costs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  incurred_on  date not null,
  category     text not null default 'other',
  description  text not null,
  amount_aed   numeric(12,2) not null default 0,
  event_id     uuid references public.events(id) on delete set null,
  notes        text
);

create index if not exists operating_costs_incurred_on_idx on public.operating_costs(incurred_on);
create index if not exists operating_costs_event_id_idx    on public.operating_costs(event_id);

-- 3. RLS ----------------------------------------------------
-- Both tables are admin-only. Locked to the public anon key; every read and
-- write happens server-side with the service-role key, which bypasses RLS.
alter table public.payments        enable row level security;
alter table public.operating_costs enable row level security;
