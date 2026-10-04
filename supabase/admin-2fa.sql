-- Two-factor (authenticator app) login for the admin area.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Lives on the existing single-row admin_settings table, which is already
-- service-role only (RLS on, no policies).

alter table public.admin_settings
  add column if not exists totp_secret         text,                          -- the active authenticator secret (base32)
  add column if not exists totp_pending_secret text,                          -- a secret shown at setup, not yet confirmed
  add column if not exists totp_enabled        boolean not null default false,
  add column if not exists totp_recovery       jsonb   not null default '[]'::jsonb,  -- SHA-256 hashes of unused one-time recovery codes
  add column if not exists totp_last_step      bigint;                        -- last accepted 30-second step, so a code cannot be replayed

-- If you are ever locked out (lost phone AND recovery codes), run this in the
-- SQL editor to switch two-factor off, then sign in with the password and set
-- it up again:
--
--   update public.admin_settings
--     set totp_enabled = false, totp_secret = null, totp_pending_secret = null,
--         totp_recovery = '[]'::jsonb, totp_last_step = null
--   where id = 1;
