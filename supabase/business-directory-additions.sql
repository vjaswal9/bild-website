-- ============================================================
-- Business directory additions: LinkedIn field.
-- Run once in Supabase → SQL Editor → New query → Run.
-- (Safe to re-run — "if not exists" guards every change.)
-- ============================================================
alter table public.business_submissions
  add column if not exists linkedin text;
