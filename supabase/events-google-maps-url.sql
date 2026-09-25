-- Optional Google Maps link for the event venue, shown on the public event
-- page next to the address.
alter table public.events add column if not exists google_maps_url text;
