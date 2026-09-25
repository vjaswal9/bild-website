-- Optional overall ticket cap for an event. Null/unset means unlimited.
alter table public.events add column if not exists capacity_limit integer;

-- Dietary requirement for the lead booker on a registration (Vegetarian /
-- Vegan / Other / blank for no preference). Each named guest's own dietary
-- requirement is stored alongside their name inside the existing
-- guest_names jsonb array - no schema change needed there.
alter table public.event_registrations add column if not exists dietary text;
