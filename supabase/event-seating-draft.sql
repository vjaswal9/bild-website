-- Draft seating: plan who sits at which table WITHOUT changing any booking,
-- then commit (or commit and lock) when ready.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Additive only: three new empty columns on events and two new functions.
-- Nothing existing is changed and no booking is rewritten by running this.

alter table public.events
  -- The shared draft: { "version": 1, "assignments": { "<groupKey>": [tables] } }
  add column if not exists seating_draft jsonb,
  add column if not exists seating_draft_updated_at timestamptz,
  -- Live assignments as they were just before the last commit, for undo.
  add column if not exists seating_last_commit jsonb;

-- Commits the draft to the real bookings in ONE transaction.
--
-- p_assignments  { "<groupKey>": [tables], ... } where groupKey is a seating
--                code, or "_solo_<registration id>" for a booking with no code.
--                Every group of the event that is not listed becomes unseated,
--                so live seating ends up matching the draft exactly.
-- p_expected     the draft timestamp the caller last saw; refused if it moved
-- p_lock         also lock the seating in the same transaction
create or replace function public.commit_seating_draft(
  p_event_id uuid,
  p_assignments jsonb,
  p_expected timestamptz,
  p_lock boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  snapshot jsonb;
  changed integer := 0;
  r record;
  want int[];
  gk text;
begin
  select id, seating_enabled, table_count, seating_locked_at, seating_draft_updated_at
    into ev from public.events where id = p_event_id for update;
  if not found then raise exception 'event_not_found'; end if;
  if ev.seating_locked_at is not null then raise exception 'locked'; end if;
  if not coalesce(ev.seating_enabled, false) or ev.table_count is null then raise exception 'seating_off'; end if;
  if ev.seating_draft_updated_at is distinct from p_expected then raise exception 'conflict'; end if;
  if jsonb_typeof(p_assignments) <> 'object' then raise exception 'bad_assignments'; end if;

  -- every table number must be a whole number between 1 and the table count
  if exists (
    select 1 from jsonb_each(p_assignments) a, jsonb_array_elements_text(a.value) t
    where t.value !~ '^[0-9]+$' or t.value::int < 1 or t.value::int > ev.table_count
  ) then raise exception 'bad_assignments'; end if;

  -- what live seating looks like now, by group, so a commit can be undone
  select coalesce(jsonb_object_agg(g.k, g.tables), '{}'::jsonb) into snapshot from (
    select coalesce(nullif(reg.seating_code, ''), '_solo_' || reg.id::text) as k,
           (jsonb_agg(to_jsonb(reg.seating_table) order by reg.id) filter (where reg.seating_table is not null)) -> 0 as tables
      from public.event_registrations reg
     where reg.event_id = p_event_id and reg.status = 'paid'
     group by 1
  ) g;

  for r in
    select reg.id::text as rid, reg.seating_code, reg.seating_table
      from public.event_registrations reg
     where reg.event_id = p_event_id and reg.status = 'paid'
  loop
    gk := coalesce(nullif(r.seating_code, ''), '_solo_' || r.rid);
    if p_assignments ? gk and jsonb_array_length(p_assignments -> gk) > 0 then
      select array_agg(x::int order by o) into want
        from jsonb_array_elements_text(p_assignments -> gk) with ordinality as e(x, o);
    else
      want := null;
    end if;
    if r.seating_table is distinct from want then
      update public.event_registrations set seating_table = want where id::text = r.rid;
      changed := changed + 1;
    end if;
  end loop;

  update public.events
     set seating_last_commit = jsonb_build_object('assignments', snapshot, 'at', now()),
         seating_locked_at = case when p_lock then now() else seating_locked_at end
   where id = p_event_id;

  return jsonb_build_object('bookingsChanged', changed, 'locked', p_lock);
end;
$$;

-- Puts live seating back as it was before the last commit.
create or replace function public.undo_seating_commit(p_event_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  snap jsonb;
  changed integer := 0;
  r record;
  want int[];
  gk text;
begin
  select id, seating_locked_at, seating_last_commit into ev from public.events where id = p_event_id for update;
  if not found then raise exception 'event_not_found'; end if;
  if ev.seating_locked_at is not null then raise exception 'locked'; end if;
  if ev.seating_last_commit is null then raise exception 'nothing_to_undo'; end if;
  snap := ev.seating_last_commit -> 'assignments';

  for r in
    select reg.id::text as rid, reg.seating_code, reg.seating_table
      from public.event_registrations reg
     where reg.event_id = p_event_id and reg.status = 'paid'
  loop
    gk := coalesce(nullif(r.seating_code, ''), '_solo_' || r.rid);
    if snap ? gk and jsonb_typeof(snap -> gk) = 'array' and jsonb_array_length(snap -> gk) > 0 then
      select array_agg(x::int order by o) into want
        from jsonb_array_elements_text(snap -> gk) with ordinality as e(x, o);
    else
      want := null;
    end if;
    if r.seating_table is distinct from want then
      update public.event_registrations set seating_table = want where id::text = r.rid;
      changed := changed + 1;
    end if;
  end loop;

  update public.events set seating_last_commit = null where id = p_event_id;
  return jsonb_build_object('bookingsChanged', changed);
end;
$$;

revoke all on function public.commit_seating_draft(uuid, jsonb, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.commit_seating_draft(uuid, jsonb, timestamptz, boolean) to service_role;
revoke all on function public.undo_seating_commit(uuid) from public, anon, authenticated;
grant execute on function public.undo_seating_commit(uuid) to service_role;
