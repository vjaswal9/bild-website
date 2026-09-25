-- Internal cost price per ticket type, used only for the admin-only
-- profit/margin export. Never selected on any public-facing query path -
-- see src/lib/events-server.ts (getEventBySlug explicitly excludes it).
alter table public.event_tickets add column if not exists cost_price_aed integer;
