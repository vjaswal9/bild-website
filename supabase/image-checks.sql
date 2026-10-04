-- Automatic alcohol check on public photos (event galleries and directory
-- images). One row per image URL that has been scanned.
--
-- Run once in the Supabase SQL editor. Service-role access only: RLS is on
-- and there are no policies, so the public anon key can neither read nor
-- write any of this.

create table if not exists image_checks (
  id            uuid primary key default gen_random_uuid(),
  url           text not null unique,
  -- 'event_gallery' | 'business_logo' | 'business_banner' | 'business_featured'
  source        text not null,
  -- The event or business the image belongs to, and a name to show an admin.
  ref_id        text,
  ref_label     text,
  -- pending | clear | flagged | blurred | kept | error
  status        text not null default 'pending',
  -- [{ x0, y0, x1, y1, kind: 'bottle' | 'glass', label }] as 0..1 fractions
  regions       jsonb not null default '[]'::jsonb,
  reason        text,
  error         text,
  blurred_url   text,
  original_path text,
  checked_at    timestamptz,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists image_checks_status_idx on image_checks (status);

alter table image_checks enable row level security;

-- A private bucket that holds the untouched original of every photo that has
-- been blurred, so a blur can always be undone by hand. Nothing here is
-- served publicly.
insert into storage.buckets (id, name, public)
values ('image-originals', 'image-originals', false)
on conflict (id) do nothing;
