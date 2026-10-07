-- Floor plan tools: one editor at a time, and renumbering tables.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Additive only. Five new empty columns on events and one new function.
-- Nothing existing is changed and no row is rewritten by running this.

alter table public.events
  -- The edit "lease": who is editing the floor plan right now, so only one
  -- admin edits at a time. Expires on its own if their screen closes.
  add column if not exists seating_edit_by text,
  add column if not exists seating_edit_name text,
  add column if not exists seating_edit_until timestamptz,
  add column if not exists seating_edit_started_at timestamptz,
  -- The last renumbering (its inverse), so it can be undone with one click.
  add column if not exists seating_last_renumber jsonb;

-- Renumbers an event's tables in ONE transaction: the floor plan layout and
-- every booking's table assignment change together, or not at all. Guests
-- follow their physical table.
--
-- p_mapping  {"old": new, ...} covering every table 1..table_count exactly once
-- p_layout   the new layout (already renumbered by the server)
-- p_expected the layout timestamp the caller last saw (null if never saved);
--            refused if someone saved since
-- p_undo     what to store so the change can be reversed
create or replace function public.renumber_event_tables(
  p_event_id uuid,
  p_mapping jsonb,
  p_layout jsonb,
  p_expected timestamptz,
  p_undo jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  n_tables integer;
  moved integer;
  stamp timestamptz := now();
begin
  select id, seating_enabled, table_count, seating_locked_at, seating_layout_updated_at
    into ev from public.events where id = p_event_id for update;
  if not found then raise exception 'event_not_found'; end if;
  if ev.seating_locked_at is not null then raise exception 'locked'; end if;
  if not coalesce(ev.seating_enabled, false) or ev.table_count is null then raise exception 'seating_off'; end if;
  if ev.seating_layout_updated_at is distinct from p_expected then raise exception 'conflict'; end if;

  n_tables := ev.table_count;
  -- The mapping must be a permutation of 1..n_tables.
  if jsonb_typeof(p_mapping) <> 'object' then raise exception 'bad_mapping'; end if;
  if (select count(*) from jsonb_each_text(p_mapping)) <> n_tables then raise exception 'bad_mapping'; end if;
  if exists (
    select 1 from jsonb_each_text(p_mapping) kv
    where kv.key !~ '^[0-9]+$' or kv.value !~ '^[0-9]+$'
       or kv.key::int < 1 or kv.key::int > n_tables
       or kv.value::int < 1 or kv.value::int > n_tables
  ) then raise exception 'bad_mapping'; end if;
  if (select count(distinct kv.value) from jsonb_each_text(p_mapping) kv) <> n_tables then raise exception 'bad_mapping'; end if;

  update public.event_registrations r
     set seating_table = (
       select array_agg(coalesce((p_mapping ->> u.t::text)::int, u.t) order by u.o)
         from unnest(r.seating_table) with ordinality as u(t, o)
     )
   where r.event_id = p_event_id
     and r.seating_table is not null
     and cardinality(r.seating_table) > 0;
  get diagnostics moved = row_count;

  update public.events
     set seating_layout = p_layout,
         seating_layout_updated_at = stamp,
         seating_last_renumber = p_undo
   where id = p_event_id;

  return jsonb_build_object('updatedAt', stamp, 'bookingsUpdated', moved);
end;
$$;

revoke all on function public.renumber_event_tables(uuid, jsonb, jsonb, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.renumber_event_tables(uuid, jsonb, jsonb, timestamptz, jsonb) to service_role;
