-- Private ticket links.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Additive only: one new column on events and one new table. Nothing
-- existing is changed.
--
-- When tickets for an event are sold by a partner (Ticketsfy) through one
-- private link, anyone who is sent that link can forward it. Instead, the
-- admin makes a personal BILD link (bild.ae/t/<token>) for each person they
-- choose, waiting list or not, and sends it by hand. It works once and
-- expires, and only then sends the person on to the partner's page, so the
-- partner's address is never in the message.

-- The partner's private ticket page for the event. Set in the admin.
alter table public.events
  add column if not exists private_ticket_url text;

create table if not exists public.event_private_links (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event_id    uuid not null references public.events(id) on delete cascade,

  name        text not null,
  phone       text,
  note        text,
  -- Set when the person was picked from the waiting list.
  waitlist_id uuid references public.event_waitlist(id) on delete set null,

  token       text not null,
  expires_at  timestamptz not null,
  opened_at   timestamptz,   -- first time the landing page was looked at
  used_at     timestamptz,   -- the button was tapped: the link is spent
  revoked_at  timestamptz    -- cancelled by an admin
);

create unique index if not exists event_private_links_token_idx on public.event_private_links(token);
create index if not exists event_private_links_event_idx on public.event_private_links(event_id);

-- RLS: locked to the public anon key, like every other table here. All access
-- is through server routes using the service-role key.
alter table public.event_private_links enable row level security;
