-- Table seating for events with assigned tables (galas, Garba, sit-down dinners).
--
-- The model: buyers form their own group by sharing a short code rather than
-- naming who they want to sit with. Nobody has to reconcile one-sided wishes -
-- a group is simply everyone who was given the same code, and admin then packs
-- those groups into the tables the event actually has.
--
-- One booking (one row in event_registrations) is already an atomic party -
-- guest_names on it always sit together, seating or not. A seating_code only
-- ever MERGES separate bookings into one larger party; it never splits one.
--
-- Run this in the Supabase SQL editor.

alter table public.events
  add column if not exists seating_enabled boolean not null default false,
  -- Both null until an admin sets them. A per-event choice, not a site default,
  -- because most BILD events (padel mornings, brunches) have no assigned
  -- seating at all.
  add column if not exists table_count integer,
  add column if not exists seats_per_table integer,
  -- Set when an admin locks the plan. Not a one-way door - the admin panel can
  -- unlock it - but while it is set, the door-list export and any "your table"
  -- email are safe to send, because nothing here will move without a
  -- deliberate unlock first.
  add column if not exists seating_locked_at timestamp with time zone;

alter table public.event_registrations
  -- The shared code. Null means "no group requested" - the booking still
  -- exists as its own one-party group for the bin-packing step, it just has no
  -- other bookings merged into it.
  add column if not exists seating_code text,
  -- The table number an admin (or auto-assign) has placed this booking's whole
  -- party at. Null until assigned. A plain integer, not a foreign key to a
  -- "tables" table - there is no such table, only a count and a capacity per
  -- event, so "table 4" only ever means "the fourth of table_count tables".
  add column if not exists seating_table integer;

-- Every lookup this feature does is "find bookings for this event with this
-- code", so the index is on the pair, not on the code alone.
create index if not exists event_registrations_event_seating_code_idx
  on public.event_registrations (event_id, seating_code)
  where seating_code is not null;
