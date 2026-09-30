alter table public.event_registrations
  add column if not exists is_complimentary boolean not null default false;
