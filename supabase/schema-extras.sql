-- BILD database: everything schema.sql cannot describe.
--
-- Captured from the live project on 2026-09-23 by running
-- supabase/schema-extras-query.sql in the Supabase SQL editor.
--
-- A RESTORE NEEDS BOTH FILES, IN THIS ORDER:
--   1. supabase/schema.sql          tables, columns, keys, foreign keys, grants
--   2. supabase/schema-extras.sql   this file
--
-- schema.sql alone would produce a database that exists but does not work:
-- no indexes so every page is slow, no row level security so the September
-- lockdown is undone, and no record_directory_event so the directory
-- statistics fail on the first page view.
--
-- Foreign keys are deliberately NOT repeated here. schema.sql declares all
-- 9 of them, guarded so a re-run is harmless; repeating them unguarded
-- would abort the restore on "constraint already exists".
--
-- 16 tables with RLS, 31 indexes, 11 constraints, 2 functions.

-- ------------------------------------------------------------------------
-- 1. Row level security
--
-- Enabled first, so no table is briefly readable while the rest of this
-- file runs.

alter table public.admin_settings enable row level security;
alter table public.business_submissions enable row level security;
alter table public.business_testimonials enable row level security;
alter table public.directory_event_dedupe enable row level security;
alter table public.directory_events enable row level security;
alter table public.directory_leads enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_tickets enable row level security;
alter table public.event_waitlist enable row level security;
alter table public.events enable row level security;
alter table public.faces_reels enable row level security;
alter table public.members enable row level security;
alter table public.milestones enable row level security;
alter table public.operating_costs enable row level security;
alter table public.payments enable row level security;
alter table public.testimonials enable row level security;

-- ------------------------------------------------------------------------
-- 2. Row level security policies
--
-- There are none, and that is deliberate rather than an omission.
-- 
-- RLS is on for every table with no policy attached, which denies all access
-- to anon and authenticated. The service role bypasses RLS, and the site
-- reaches the database only through it, server side. The anon key ships in
-- every page of the site, so a policy granted to anon is a policy granted to
-- the internet.
-- 
-- If a future change adds a policy here, that is the decision to think hard
-- about.


-- ------------------------------------------------------------------------
-- 3. Indexes
--
-- Excludes the indexes Postgres creates to back a constraint - those arrive
-- with the constraint in section 4.

CREATE INDEX business_submissions_activation_chase_idx ON public.business_submissions USING btree (status, listing_abandoned_at, listing_payment_token_expires_at) WHERE (listing_paid_until IS NULL);
CREATE INDEX business_submissions_featured_token_idx ON public.business_submissions USING btree (featured_payment_token) WHERE (featured_payment_token IS NOT NULL);
CREATE INDEX business_submissions_listing_token_idx ON public.business_submissions USING btree (listing_payment_token) WHERE (listing_payment_token IS NOT NULL);
CREATE INDEX business_submissions_manage_token_idx ON public.business_submissions USING btree (featured_manage_token) WHERE (featured_manage_token IS NOT NULL);
CREATE UNIQUE INDEX business_submissions_renewal_token_idx ON public.business_submissions USING btree (renewal_token) WHERE (renewal_token IS NOT NULL);
CREATE UNIQUE INDEX business_submissions_slug_idx ON public.business_submissions USING btree (slug) WHERE (slug IS NOT NULL);
CREATE INDEX business_submissions_status_idx ON public.business_submissions USING btree (status);
CREATE INDEX business_testimonials_business_status_idx ON public.business_testimonials USING btree (business_id, status);
CREATE INDEX business_testimonials_status_idx ON public.business_testimonials USING btree (status, created_at DESC);
CREATE INDEX business_website_fail_idx ON public.business_submissions USING btree (website_fail_count);
CREATE INDEX directory_event_dedupe_day_idx ON public.directory_event_dedupe USING btree (day);
CREATE INDEX directory_events_business_day_idx ON public.directory_events USING btree (business_id, day DESC);
CREATE INDEX directory_events_day_idx ON public.directory_events USING btree (day DESC);
CREATE INDEX directory_leads_open_idx ON public.directory_leads USING btree (created_at DESC) WHERE (completed_at IS NULL);
CREATE INDEX event_registrations_event_id_idx ON public.event_registrations USING btree (event_id);
CREATE INDEX event_registrations_event_status_idx ON public.event_registrations USING btree (event_id, status);
CREATE INDEX event_tickets_event_id_idx ON public.event_tickets USING btree (event_id);
CREATE INDEX event_waitlist_event_idx ON public.event_waitlist USING btree (event_id);
CREATE INDEX event_waitlist_status_idx ON public.event_waitlist USING btree (status);
CREATE UNIQUE INDEX event_waitlist_unique_person ON public.event_waitlist USING btree (event_id, lower(email));
CREATE INDEX members_email_idx ON public.members USING btree (email);
CREATE INDEX members_status_idx ON public.members USING btree (status);
CREATE INDEX milestones_sort_idx ON public.milestones USING btree (sort_order);
CREATE INDEX operating_costs_event_id_idx ON public.operating_costs USING btree (event_id);
CREATE INDEX operating_costs_incurred_on_idx ON public.operating_costs USING btree (incurred_on);
CREATE INDEX payments_event_id_idx ON public.payments USING btree (event_id);
CREATE INDEX payments_kind_idx ON public.payments USING btree (kind);
CREATE INDEX payments_paid_at_idx ON public.payments USING btree (paid_at);
CREATE INDEX payments_reference_idx ON public.payments USING btree (reference_id);
CREATE INDEX payments_stripe_charge_id_idx ON public.payments USING btree (stripe_charge_id);
CREATE INDEX testimonials_business_id_idx ON public.testimonials USING btree (business_id, status);

-- ------------------------------------------------------------------------
-- 4. Unique and check constraints
--
-- Primary keys are inline in schema.sql and foreign keys are at the end of
-- it, so neither is repeated here.

alter table admin_settings add constraint admin_settings_single_row CHECK ((id = 1));
alter table business_submissions add constraint business_submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table business_testimonials add constraint business_testimonials_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])));
alter table directory_leads add constraint directory_leads_email_key UNIQUE (email);
alter table event_registrations add constraint event_registrations_attendee_age_check CHECK (((attendee_age IS NULL) OR ((attendee_age >= 0) AND (attendee_age <= 17))));
alter table event_waitlist add constraint event_waitlist_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'invited'::text, 'converted'::text, 'declined'::text, 'removed'::text])));
alter table events add constraint events_slug_key UNIQUE (slug);
alter table payments add constraint payments_kind_check CHECK ((kind = ANY (ARRAY['membership'::text, 'event_ticket'::text, 'listing'::text, 'featured'::text, 'sponsorship'::text, 'other'::text])));
alter table payments add constraint payments_stripe_session_id_key UNIQUE (stripe_session_id);
alter table testimonials add constraint testimonials_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table testimonials add constraint testimonials_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

-- ------------------------------------------------------------------------
-- 5. Functions
--
-- record_directory_event is called on every directory page view and link
-- click; prune_directory_dedupe runs nightly from the tidy-checkouts cron.
-- Without these the directory statistics fail.

CREATE OR REPLACE FUNCTION public.prune_directory_dedupe()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with gone as (
    delete from public.directory_event_dedupe where day < current_date - 3 returning 1
  ) select count(*)::integer from gone;
$function$
;
CREATE OR REPLACE FUNCTION public.record_directory_event(p_business uuid, p_kind text, p_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_kind not in (
    'view', 'click_phone', 'click_whatsapp', 'click_email',
    'click_website', 'click_instagram', 'click_brochure', 'click_maps'
  ) then
    return false;
  end if;

  begin
    insert into public.directory_event_dedupe (hash) values (p_hash);
  exception when unique_violation then
    return false;   -- already counted this visitor, this listing, today
  end;

  insert into public.directory_events (business_id, kind, day, count)
  values (p_business, p_kind, current_date, 1)
  on conflict (business_id, kind, day)
  do update set count = directory_events.count + 1;

  return true;
end;
$function$
;

