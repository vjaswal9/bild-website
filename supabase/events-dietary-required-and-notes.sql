-- Per-event toggle: only show the dietary dropdown on the booking form when
-- an event actually needs it (not every event has catering).
alter table public.events add column if not exists dietary_required boolean not null default false;

-- Free-text detail for the lead booker when they pick "Other" for dietary.
-- Each named guest's own note is stored alongside their name inside the
-- existing guest_names jsonb array - no schema change needed there.
alter table public.event_registrations add column if not exists dietary_note text;
