-- Mahjong interest register.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Additive only: one new table. Nothing existing is changed.
--
-- People register interest in BILD Mahjong classes and socials on /mahjong.
-- It is an expression of interest only: no payment, and no email address is
-- asked for, because the follow-up is by WhatsApp. One row per WhatsApp number,
-- so signing up twice updates the first row instead of adding a second.

create table if not exists public.mahjong_interest (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  full_name       text not null,
  whatsapp        text not null,          -- as typed, for display
  whatsapp_digits text not null,          -- digits only, for matching duplicates
  member_status   text not null,          -- yes | joining | unsure
  area            text not null,
  experience      text not null,          -- beginner | refresher | player
  availability    text[] not null default '{}',
  notes           text,
  consented_at    timestamptz not null default now()
);

create unique index if not exists mahjong_interest_whatsapp_idx on public.mahjong_interest(whatsapp_digits);
create index if not exists mahjong_interest_created_idx on public.mahjong_interest(created_at desc);

-- RLS: locked to the public anon key, like every other table here. All access
-- is through server routes using the service-role key.
alter table public.mahjong_interest enable row level security;
