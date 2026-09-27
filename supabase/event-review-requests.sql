-- Who has already been asked for a Google review, and when.
--
-- WHY THIS EXISTS: around twenty genuine reviews were filtered out by Google.
-- The pattern that causes it is a burst - thirty members reviewing at the same
-- event, on the same venue wifi, inside an hour, mostly from accounts with no
-- review history. Google's spam filter reads that as coordinated and removes
-- the lot, and filtered reviews have no self-service appeal.
--
-- So the ask has to become a trickle. This table is what makes that possible:
-- it remembers who has been asked, so the cron can send a small number each
-- day, never ask the same person twice for the same event, and leave a long
-- gap before asking anyone again.
--
-- Run this in the Supabase SQL editor.

create table if not exists public.event_review_requests (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  email      text not null,
  first_name text,
  sent_at    timestamp with time zone not null default now()
);

-- One ask per person per event. The cron relies on this: it reads the rows
-- back to work out who is left, and the constraint is the backstop if two runs
-- ever overlap.
create unique index if not exists event_review_requests_event_email_idx
  on public.event_review_requests (event_id, lower(email));

-- "Has this person been asked recently, for anything?" - the query that stops
-- a regular attendee being asked after every single event.
create index if not exists event_review_requests_email_sent_idx
  on public.event_review_requests (lower(email), sent_at desc);

-- Service role only, like every other table here. The anon key ships in every
-- page of the site, so a policy granted to anon is granted to the internet.
alter table public.event_review_requests enable row level security;
grant select, insert, update, delete on public.event_review_requests to service_role;
