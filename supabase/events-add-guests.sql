-- ============================================================
-- Add multi-ticket quantity + guest names to registrations.
-- Run this once in Supabase → SQL Editor (safe to re-run).
-- ============================================================
alter table public.event_registrations
  add column if not exists quantity    integer not null default 1,
  add column if not exists guest_names jsonb   not null default '[]';  -- ["Full Name", ...] for the extra tickets
