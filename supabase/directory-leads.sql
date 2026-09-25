-- Businesses that started the directory form but never submitted it.
--
-- The membership form already does this: JoinForm writes a `members` row at
-- the eligibility step, so anyone who leaves before paying is still visible and
-- the weekly digest can chase them. The directory form could not, because it is
-- a single page of 22 fields that only writes a row on the final submit -
-- somebody who fills in fifteen fields and closes the tab leaves no trace.
--
-- A separate table on purpose. business_submissions feeds the admin review
-- queue, and filling it with half-finished records would make that queue
-- untrustworthy. A lead here is not an application; it becomes one only when
-- the form is actually submitted.
--
-- Run this in the Supabase SQL editor.

create table if not exists public.directory_leads (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  business_name text,
  owner_name    text,
  phone         text,
  category      text,
  location      text,
  -- How far they got, so the digest can say "stopped after the description"
  -- rather than just naming them.
  fields_filled integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Set when the same email completes a real submission. Kept rather than
  -- deleted, so the report can show recovered sign-ups the way the member one
  -- does.
  completed_at  timestamptz,
  -- Stops the weekly digest naming the same business every week forever.
  reported_at   timestamptz
);

-- One row per email. A returning visitor updates their lead rather than
-- creating a second one.
--
-- A plain unique constraint on the column, not a functional index on
-- lower(email): PostgREST's upsert resolves on_conflict against a real
-- constraint, and would not match a functional index. The application
-- lowercases every address before it gets here, so the two are equivalent.
do $$
begin
  alter table public.directory_leads
    add constraint directory_leads_email_key unique (email);
exception when duplicate_table or duplicate_object then
  null;   -- already there; this script is safe to run twice
end $$;

create index if not exists directory_leads_open_idx
  on public.directory_leads (created_at desc) where completed_at is null;

-- Row level security on, and deliberately no policies. The anon key ships in
-- every page of this site, and this table holds the contact details of people
-- who have not finished an application - the last thing that should be
-- readable by the public. All access is server side through the service role,
-- which bypasses RLS.
alter table public.directory_leads enable row level security;

-- VERIFY: one row, rowsecurity true, zero policies.
select tablename, rowsecurity,
       (select count(*) from pg_policies p where p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public' and tablename = 'directory_leads';
