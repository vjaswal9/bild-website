-- Faces of BILD: admin-managed Instagram reels (replaces the static
-- src/data/reels.json file).
create table if not exists public.faces_reels (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  url        text not null,
  caption    text,
  active     boolean not null default true
);

-- RLS: keep the table locked to the public anon key. All reads/writes
-- happen server-side via the service-role key, which bypasses RLS.
alter table public.faces_reels enable row level security;
