-- ============================================================
-- Admin settings: lets the admin password be changed at runtime
-- (with email confirmation) instead of only via an env var.
-- Run once in Supabase → SQL Editor.
-- ============================================================
create table if not exists public.admin_settings (
  id              int primary key default 1,
  password_hash   text,               -- PBKDF2 hash of the current password (null = use env fallback)
  pending_hash    text,               -- hash of a requested new password, awaiting email confirmation
  pending_token   text,               -- one-time confirmation token
  pending_expires timestamptz,        -- when the pending change lapses
  updated_at      timestamptz not null default now(),
  constraint admin_settings_single_row check (id = 1)
);

insert into public.admin_settings (id) values (1) on conflict (id) do nothing;

-- All access is server-side via the service-role key, which bypasses RLS.
alter table public.admin_settings enable row level security;
