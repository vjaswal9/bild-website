-- Testimonials a business has received from its own customers, which the
-- business uploads itself with proof, and an admin approves before they appear
-- on that business's profile page.
--
-- Deliberately separate from the `testimonials` table. That one holds members'
-- testimonials about BILD, written by the person giving the praise. These are
-- written by the business about itself, quoting a customer, and only mean
-- anything because a screenshot of the original message is attached. Different
-- author, different evidence, different moderation question, so a different
-- table rather than more nullable columns on a table that already carries two
-- meanings.
--
-- No star rating on purpose: the request was a customer name and their words.
--
-- Run this in the Supabase SQL editor.

create table if not exists public.business_testimonials (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.business_submissions(id) on delete cascade,
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz,

  -- The customer who gave the testimonial, and what they said.
  customer_name  text not null,
  quote          text not null,

  -- Path (not a public URL) to the screenshot of the original email, WhatsApp
  -- or text. The bucket is private, so this is only ever readable by an admin
  -- through a short-lived signed link. It is somebody's private message and
  -- must never be shown to visitors.
  proof_path     text,

  status         text not null default 'pending'
                 check (status in ('pending', 'approved', 'declined')),

  -- Shown to the business in the decline email so they know what to fix.
  decline_reason text
);

-- The profile page asks for one business's approved testimonials on every
-- view; the admin queue asks for everything pending.
create index if not exists business_testimonials_business_status_idx
  on public.business_testimonials (business_id, status);
create index if not exists business_testimonials_status_idx
  on public.business_testimonials (status, created_at desc);

-- Locked to the public key, like every other table. All reads and writes go
-- through the server with the service-role key, which bypasses RLS.
-- Deliberately no policies: see supabase/lock-business-submissions.sql for why
-- a policy granted to `anon` is a policy granted to the internet.
alter table public.business_testimonials enable row level security;


-- ---------------------------------------------------------------------------
-- Give every approved business a manage link.
--
-- featured_manage_token was only ever issued when a business paid for
-- Featured, because the manage page only held Featured content. It now also
-- holds the testimonials form, which every approved business may use, so every
-- approved business needs a token.
--
-- Despite the name, treat this column as the general "manage my listing"
-- token. Existing tokens are left exactly as they are, so links already sitting
-- in businesses' inboxes keep working.
-- ---------------------------------------------------------------------------
update public.business_submissions
set featured_manage_token = replace(gen_random_uuid()::text, '-', '')
where status = 'approved'
  and featured_manage_token is null;


-- ---------------------------------------------------------------------------
-- Private bucket for the proof screenshots.
--
-- Private, not public: these are screenshots of customers' private emails and
-- WhatsApp messages. They exist so an admin can verify a testimonial is real,
-- and for nothing else. Admins view them through a signed link that expires.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('testimonial-proof', 'testimonial-proof', false)
on conflict (id) do nothing;

-- No storage policies are added, on purpose. Uploads arrive through
-- /api/uploads/sign, which authorises the business and issues a one-time
-- signed upload token, and signed uploads do not consult policies at all.


-- ---------------------------------------------------------------------------
-- VERIFY
select count(*) as approved_without_a_manage_link
from public.business_submissions
where status = 'approved' and featured_manage_token is null;   -- expect 0

select policyname from pg_policies
where schemaname = 'public' and tablename = 'business_testimonials';  -- expect none
-- ---------------------------------------------------------------------------
