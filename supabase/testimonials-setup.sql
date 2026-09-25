-- Member-submitted testimonials, shown on the homepage alongside Google
-- reviews once approved. Public submissions start pending and only appear
-- on the site after an admin approves them.
create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  name        text not null,
  headline    text,
  quote       text not null,
  rating      smallint not null default 5 check (rating between 1 and 5),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);

-- RLS: keep the table locked to the public anon key. All reads/writes
-- happen server-side via the service-role key, which bypasses RLS.
alter table public.testimonials enable row level security;
