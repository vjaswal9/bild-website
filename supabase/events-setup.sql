-- ============================================================
-- BILD Events + Ticketing schema
-- Run this once in Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1. EVENTS -------------------------------------------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  slug        text unique not null,
  title       text not null,
  description text default '',
  venue       text default '',
  location    text default '',
  flyer_url   text,
  event_date  timestamptz not null,
  end_date    timestamptz,
  status      text not null default 'draft',   -- draft | published
  tags        text[] not null default '{}',
  gallery     jsonb  not null default '[]'      -- [{ "url": "...", "type": "image" | "video" }]
);

-- 2. TICKET TYPES -------------------------------------------
create table if not exists public.event_tickets (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event_id    uuid not null references public.events(id) on delete cascade,
  name        text not null,                    -- e.g. "Alcohol package"
  description text default '',                  -- e.g. "Includes house drinks"
  price_aed   integer not null default 0,       -- whole AED, e.g. 250
  sort_order  integer not null default 0,
  active      boolean not null default true
);
create index if not exists event_tickets_event_id_idx on public.event_tickets(event_id);

-- 3. REGISTRATIONS (attendees / door list) ------------------
create table if not exists public.event_registrations (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  event_id          uuid not null references public.events(id) on delete cascade,
  ticket_id         uuid references public.event_tickets(id) on delete set null,
  ticket_name       text,
  first_name        text not null,
  last_name         text not null,
  email             text not null,
  phone             text,
  quantity          integer not null default 1,
  guest_names       jsonb   not null default '[]',   -- ["Full Name", ...] for the extra tickets
  amount_aed        integer not null default 0,
  status            text not null default 'pending',  -- pending | paid
  stripe_session_id text,
  paid_at           timestamptz
);
create index if not exists event_registrations_event_id_idx on public.event_registrations(event_id);

-- RLS: keep tables locked to the public anon key. All reads/writes
-- happen server-side via the service-role key, which bypasses RLS.
alter table public.events               enable row level security;
alter table public.event_tickets        enable row level security;
alter table public.event_registrations  enable row level security;

-- ============================================================
-- 4. STORAGE BUCKETS (flyers + past-event photos/videos)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('event-flyers', 'event-flyers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do nothing;

-- Allow uploads from the admin page (anon key) into these two buckets.
drop policy if exists "event flyers upload" on storage.objects;
create policy "event flyers upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'event-flyers');

drop policy if exists "event media upload" on storage.objects;
create policy "event media upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'event-media');

-- Public read of both buckets (they are marked public above, this is belt-and-braces).
drop policy if exists "event assets read" on storage.objects;
create policy "event assets read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('event-flyers', 'event-media'));
