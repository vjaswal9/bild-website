-- Close public access to business_submissions.
--
-- WHAT WAS WRONG
-- Enabling RLS was not enough on its own. Two permissive policies already
-- existed on this table and were granting the anon role access:
--
--   public_insert          anon, INSERT, with_check = true
--   public_read_approved   anon, SELECT, using (status = 'approved')
--
-- The anon key is published in the JavaScript of every page, so both were
-- effectively open to the internet.
--
-- public_insert is the more serious of the two. `with_check = true` accepts
-- any row whatsoever, so anyone could write directly into this table,
-- bypassing /api/business/submit and therefore its rate limiting, its
-- validation and its length caps. Nothing constrained the column values
-- either, so a row could be inserted with status = 'approved' and
-- featured = true and would appear live in the directory, carrying whatever
-- links its author chose, without an admin ever reviewing it.
--
-- public_read_approved leaked whole rows. RLS filters rows, not columns, so
-- "readable if approved" meant every column of every approved business:
-- featured_manage_token (which opens that business's content editor),
-- listing_payment_token, featured_payment_token, renewal_token, email, phone,
-- owner_name, document_url (their trade licence) and admin_notes (private
-- staff commentary). Verified on 2026-09-17: the public key returned all 33
-- approved rows and every one of those columns.
--
-- WHY DROPPING BOTH IS SAFE
-- Nothing in the browser reads or writes this table. The anon client
-- (src/lib/supabase) is imported by six files and every one uses it solely for
-- supabase.storage uploads, never .from('business_submissions'). The directory
-- listing and profile pages are server components, and submissions go through
-- /api/business/submit. All of those use the service-role key, which bypasses
-- RLS entirely.
--
-- This leaves the table matching the rest of the schema: RLS on, no policies,
-- which in Postgres denies everything to anon.

alter table public.business_submissions enable row level security;

drop policy if exists public_insert        on public.business_submissions;
drop policy if exists public_read_approved on public.business_submissions;

-- Deliberately no replacement policy. There is no case where the public key
-- should read or write any of this; adding one back re-opens the hole.

-- ---------------------------------------------------------------------------
-- VERIFY
-- Should return no rows at all:
select policyname, cmd, roles
from pg_policies
where tablename = 'business_submissions';

-- Should show rls_enabled = true:
select relname, relrowsecurity as rls_enabled
from pg_class
where relname = 'business_submissions';
-- ---------------------------------------------------------------------------
