-- Shared rate limiter. The in-memory limiter the site used before counts per
-- server instance, and serverless runs many instances, so a determined script
-- could multiply its allowance. This keeps one counter per key in the
-- database, shared by every instance.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- Service-role only: RLS is on with no policies, and the function is not
-- executable by the public anon or authenticated roles.

create table if not exists rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

alter table rate_limits enable row level security;

-- Records one hit and returns how many hits the key has in its current window.
-- A hit older than the window starts a fresh window. One atomic statement, so
-- two simultaneous requests cannot both read the same count.
create or replace function rate_limit_hit(p_key text, p_window_seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c integer;
begin
  insert into rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else r.count + 1
    end,
    window_start = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else r.window_start
    end
  returning r.count into c;
  return c;
end;
$$;

revoke all on function rate_limit_hit(text, integer) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, integer) to service_role;

-- Housekeeping, called by the nightly tidy-up job.
create or replace function prune_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from rate_limits where window_start < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function prune_rate_limits() from public, anon, authenticated;
grant execute on function prune_rate_limits() to service_role;
