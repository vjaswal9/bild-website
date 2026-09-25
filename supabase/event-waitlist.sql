-- ============================================================
-- EVENT WAITLIST
--
-- When a capped event sells out, the page currently tells people to
-- email events@bild.ae. That works, but the request then lives in an
-- inbox: nobody knows how many are waiting, who asked first, or who to
-- contact when a refund frees a seat.
--
-- This records the queue properly, in order, against the event.
-- ============================================================

create table if not exists public.event_waitlist (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event_id    uuid not null references public.events(id) on delete cascade,

  first_name  text not null,
  last_name   text not null default '',
  email       text not null,
  phone       text,

  -- How many tickets they are hoping for, so an admin can tell whether a
  -- single freed seat helps them or not.
  tickets_wanted integer not null default 1,
  note        text,

  -- waiting   : in the queue
  -- invited   : told a place is available, not yet booked
  -- converted : they booked, manually marked by an admin
  -- declined  : they no longer want it
  -- removed   : taken off the list by an admin
  status      text not null default 'waiting'
              check (status in ('waiting', 'invited', 'converted', 'declined', 'removed')),

  invited_at  timestamptz,
  admin_note  text
);

create index if not exists event_waitlist_event_idx  on public.event_waitlist(event_id);
create index if not exists event_waitlist_status_idx on public.event_waitlist(status);

-- One entry per person per event. A second attempt updates their existing
-- row rather than creating a duplicate, so the queue order is not gamed by
-- signing up repeatedly.
create unique index if not exists event_waitlist_unique_person
  on public.event_waitlist(event_id, lower(email));

-- RLS: locked to the public anon key, matching every other table here. The
-- public join form writes through a server route using the service-role key.
alter table public.event_waitlist enable row level security;

-- Lets an event be closed to new waitlist entries without unpublishing it,
-- for example once the event has happened or the queue is unmanageably long.
alter table public.events
  add column if not exists waitlist_open boolean not null default true;
