-- Adds a "source" label to bookings: where a booking came from when it was not
-- made on the site (the Ticketsfy import sets it to 'TICKETSFY IMPORT').
-- Null for every ordinary booking, so nothing existing changes. Shown only to
-- admins and as a Source column on the door list.
-- Safe to run more than once.

alter table public.event_registrations
  add column if not exists source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'event_registrations_source_len'
  ) then
    alter table public.event_registrations
      add constraint event_registrations_source_len
      check (source is null or char_length(source) <= 40);
  end if;
end $$;
