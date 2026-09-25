-- Directory statistics: what a Featured listing actually gets for its money.
--
-- The old counter was a single running total on business_submissions, and it
-- only moved for Featured listings. That made it useless as a selling point:
-- with no figure for a standard listing there is nothing to compare against,
-- and with no dates there is no way to say "last month". It also read the
-- current value and wrote value+1, so two simultaneous visitors both read the
-- same number and one view was lost.
--
-- This replaces it with one row per listing, per event kind, per day. Small,
-- cheap to query, and it answers "last 30 days" and "is this trending" without
-- storing anything per visitor.
--
-- Run this in the Supabase SQL editor.

-- ---------------------------------------------------------------- the counts
create table if not exists public.directory_events (
  business_id uuid not null references public.business_submissions(id) on delete cascade,
  kind        text not null,
  day         date not null,
  count       integer not null default 0,
  primary key (business_id, kind, day)
);

create index if not exists directory_events_day_idx
  on public.directory_events (day desc);
create index if not exists directory_events_business_day_idx
  on public.directory_events (business_id, day desc);

-- ------------------------------------------------------------- the de-duper
-- One hash per visitor, per listing, per kind, per day. A visitor refreshing a
-- profile ten times is one view, which matters when the number is being shown
-- to the business as evidence. Rows are disposable and pruned after 3 days.
create table if not exists public.directory_event_dedupe (
  hash text primary key,
  day  date not null default current_date
);
create index if not exists directory_event_dedupe_day_idx
  on public.directory_event_dedupe (day);

-- ------------------------------------------------------------------- the RPC
-- Atomic: de-dupe and increment in one statement pair, so concurrent visitors
-- cannot lose a count the way the old read-then-write did. Returns true when
-- the event was counted, false when it was a repeat or an unknown kind.
create or replace function public.record_directory_event(
  p_business uuid,
  p_kind     text,
  p_hash     text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in (
    'view', 'click_phone', 'click_whatsapp', 'click_email',
    'click_website', 'click_instagram', 'click_brochure', 'click_maps'
  ) then
    return false;
  end if;

  begin
    insert into public.directory_event_dedupe (hash) values (p_hash);
  exception when unique_violation then
    return false;   -- already counted this visitor, this listing, today
  end;

  insert into public.directory_events (business_id, kind, day, count)
  values (p_business, p_kind, current_date, 1)
  on conflict (business_id, kind, day)
  do update set count = directory_events.count + 1;

  return true;
end;
$$;

-- --------------------------------------------------------------- housekeeping
create or replace function public.prune_directory_dedupe() returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.directory_event_dedupe where day < current_date - 3 returning 1
  ) select count(*)::integer from gone;
$$;

-- --------------------------------------------------------------------- lockdown
-- RLS on, and deliberately NO policies. The anon key ships in every page of
-- the site, so anything granted to anon is granted to the internet - and these
-- numbers are a paid benefit. All reads and writes go through the service role
-- on the server, which bypasses RLS.
alter table public.directory_events        enable row level security;
alter table public.directory_event_dedupe  enable row level security;

revoke all on function public.record_directory_event(uuid, text, text) from public, anon;
revoke all on function public.prune_directory_dedupe() from public, anon;

-- VERIFY: both tables exist, RLS on, zero policies.
select tablename, rowsecurity,
       (select count(*) from pg_policies p where p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public' and tablename in ('directory_events','directory_event_dedupe');
