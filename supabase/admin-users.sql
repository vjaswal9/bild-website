-- Personal admin accounts: each admin signs in with their own email, password
-- and authenticator app, and can be removed without touching anyone else.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Until the first row exists the site keeps using the single shared login
-- (admin_settings). The existing admin turns on personal accounts from
-- Admin -> Security, which copies their current password and authenticator
-- into the first row here.
--
-- If you are ever locked out, deleting every row in this table puts the site
-- back on the single shared login:   delete from public.admin_users;

create table if not exists public.admin_users (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  name                text not null default '',
  password_hash       text,
  -- Authenticator (TOTP) state, same meaning as on admin_settings.
  totp_secret         text,
  totp_pending_secret text,
  totp_enabled        boolean not null default false,
  totp_recovery       jsonb   not null default '[]'::jsonb,
  totp_last_step      bigint,
  -- false until the invited person has set a password and an authenticator,
  -- and again once they are removed.
  active              boolean not null default false,
  -- Sign-in cookies issued before this moment stop working, so removing an
  -- admin or changing a password ends their other sessions at once.
  sessions_valid_from timestamptz not null default now(),
  -- SHA-256 of the one-time invite link, never the link itself.
  invite_token_hash   text,
  invite_expires_at   timestamptz,
  invited_by          uuid,
  last_login_at       timestamptz,
  created_at          timestamptz not null default now()
);

create unique index if not exists admin_users_email_key on public.admin_users (lower(email));
create index if not exists admin_users_invite_idx on public.admin_users (invite_token_hash);

alter table public.admin_users enable row level security;
