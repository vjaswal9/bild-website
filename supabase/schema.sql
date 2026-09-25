-- BILD database schema, generated from the live project on 2026-09-23.
--
-- Regenerate with:  node scripts/dump-schema.mjs
--
-- WHY THIS EXISTS: the weekly members-backup cron saves the data; nothing
-- saved the structure. members and business_submissions had no create table
-- statement anywhere in this repo, so the backup spreadsheet had nowhere to
-- be restored to.
--
-- COVERS: columns, types, defaults, NOT NULL, primary keys, foreign keys.
-- DOES NOT COVER: indexes, unique constraints beyond the primary key, check
-- constraints, triggers, functions and RLS policies. The query at the bottom
-- of this file collects those from the Supabase SQL editor.
--
-- Grants are explicit. From 30 October 2026 Supabase no longer grants Data
-- API access to new tables automatically, so a rebuild without these would
-- produce tables the site cannot read. service_role only, deliberately: the
-- anon key ships in every page of the site and must never reach these.

-- ------------------------------------------------------------------------
create table if not exists public.admin_settings (
  id                                 integer default 1 not null,
  password_hash                      text,
  pending_hash                       text,
  pending_token                      text,
  pending_expires                    timestamp with time zone,
  updated_at                         timestamp with time zone default now() not null,
  last_stripe_import_at              timestamp with time zone,
  primary key (id)
);
grant select, insert, update, delete on public.admin_settings to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.business_submissions (
  id                                 uuid default gen_random_uuid() not null,
  created_at                         timestamp with time zone default now(),
  status                             text default 'pending',
  business_name                      text not null,
  category                           text not null,
  description                        text not null,
  location                           text not null,
  owner_name                         text not null,
  phone                              text not null,
  email                              text not null,
  website                            text,
  instagram                          text,
  logo_url                           text,
  years_in_business                  text,
  bild_offer                         text,
  extra_info                         text,
  admin_notes                        text,
  reviewed_at                        timestamp with time zone,
  document_url                       text,
  tagline                            text,
  established_year                   text,
  featured                           boolean default false,
  linkedin                           text,
  document_expiry_date               date,
  delisted_at                        timestamp with time zone,
  delisted_reason                    text,
  document_reminder_sent_at          timestamp with time zone,
  renewal_token                      text,
  renewal_token_expires_at           timestamp with time zone,
  pending_document_url               text,
  pending_document_expiry_date       date,
  pending_renewal_submitted_at       timestamp with time zone,
  business_country                   text default 'UAE' not null,
  slug                               text,
  bild_member_since                  text,
  is_bild_member                     boolean default true not null,
  listing_paid_until                 timestamp with time zone,
  listing_payment_token              text,
  listing_payment_token_expires_at   timestamp with time zone,
  listing_renewal_reminder_sent_at   timestamp with time zone,
  listing_final_reminder_sent_at     timestamp with time zone,
  listing_expired_notice_sent_at     timestamp with time zone,
  listing_fee_exempt                 boolean default false not null,
  featured_paid_until                timestamp with time zone,
  featured_payment_token             text,
  featured_payment_token_expires_at  timestamp with time zone,
  featured_renewal_reminder_sent_at  timestamp with time zone,
  featured_final_reminder_sent_at    timestamp with time zone,
  featured_expired_notice_sent_at    timestamp with time zone,
  featured_manage_token              text,
  featured_bio                       text,
  featured_gallery_urls              text[],
  featured_video_url                 text,
  featured_offers                    text[],
  profile_view_count                 integer default 0 not null,
  google_maps_url                    text,
  google_place_id                    text,
  membership_manually_verified       boolean default false not null,
  banner_url                         text,
  instagram_post_url                 text,
  banner_bg                          text,
  website_checked_at                 timestamp with time zone,
  website_status                     integer,
  website_fail_count                 integer default 0 not null,
  website_error                      text,
  featured_brochure_url              text,
  featured_brochure_name             text,
  listing_activation_reminder_sent_at timestamp with time zone,
  listing_abandoned_at               timestamp with time zone,
  primary key (id)
);
grant select, insert, update, delete on public.business_submissions to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.business_testimonials (
  id                                 uuid default gen_random_uuid() not null,
  business_id                        uuid not null,
  created_at                         timestamp with time zone default now() not null,
  reviewed_at                        timestamp with time zone,
  customer_name                      text not null,
  quote                              text not null,
  proof_path                         text,
  status                             text default 'pending' not null,
  decline_reason                     text,
  primary key (id)
);
grant select, insert, update, delete on public.business_testimonials to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.directory_event_dedupe (
  hash                               text not null,
  day                                date default CURRENT_DATE not null,
  primary key (hash)
);
grant select, insert, update, delete on public.directory_event_dedupe to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.directory_events (
  business_id                        uuid not null,
  kind                               text not null,
  day                                date not null,
  count                              integer default 0 not null,
  primary key (business_id, kind, day)
);
grant select, insert, update, delete on public.directory_events to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.directory_leads (
  id                                 uuid default gen_random_uuid() not null,
  email                              text not null,
  business_name                      text,
  owner_name                         text,
  phone                              text,
  category                           text,
  location                           text,
  fields_filled                      integer default 0 not null,
  created_at                         timestamp with time zone default now() not null,
  updated_at                         timestamp with time zone default now() not null,
  completed_at                       timestamp with time zone,
  reported_at                        timestamp with time zone,
  primary key (id)
);
grant select, insert, update, delete on public.directory_leads to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.event_registrations (
  id                                 uuid default gen_random_uuid() not null,
  created_at                         timestamp with time zone default now() not null,
  event_id                           uuid not null,
  ticket_id                          uuid,
  ticket_name                        text,
  first_name                         text not null,
  last_name                          text not null,
  email                              text not null,
  phone                              text,
  amount_aed                         integer default 0 not null,
  status                             text default 'pending' not null,
  stripe_session_id                  text,
  paid_at                            timestamp with time zone,
  quantity                           integer default 1 not null,
  guest_names                        jsonb not null,
  refunded_at                        timestamp with time zone,
  dietary                            text,
  dietary_note                       text,
  refunded_amount_aed                numeric default 0 not null,
  admin_note                         text,
  attendee_age                       smallint,
  primary key (id)
);
grant select, insert, update, delete on public.event_registrations to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.event_tickets (
  id                                 uuid default gen_random_uuid() not null,
  created_at                         timestamp with time zone default now() not null,
  event_id                           uuid not null,
  name                               text not null,
  description                        text default '',
  price_aed                          integer default 0 not null,
  sort_order                         integer default 0 not null,
  active                             boolean default true not null,
  cost_price_aed                     integer,
  is_child                           boolean default false not null,
  primary key (id)
);
grant select, insert, update, delete on public.event_tickets to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.event_waitlist (
  id                                 uuid default gen_random_uuid() not null,
  created_at                         timestamp with time zone default now() not null,
  event_id                           uuid not null,
  first_name                         text not null,
  last_name                          text default '' not null,
  email                              text not null,
  phone                              text,
  tickets_wanted                     integer default 1 not null,
  note                               text,
  status                             text default 'waiting' not null,
  invited_at                         timestamp with time zone,
  admin_note                         text,
  primary key (id)
);
grant select, insert, update, delete on public.event_waitlist to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.events (
  id                                 uuid default gen_random_uuid() not null,
  created_at                         timestamp with time zone default now() not null,
  slug                               text not null,
  title                              text not null,
  description                        text default '',
  venue                              text default '',
  location                           text default '',
  flyer_url                          text,
  event_date                         timestamp with time zone not null,
  end_date                           timestamp with time zone,
  status                             text default 'draft' not null,
  tags                               text[] not null,
  gallery                            jsonb not null,
  google_maps_url                    text,
  capacity_limit                     integer,
  dietary_required                   boolean default false not null,
  has_extra_finances                 boolean default false not null,
  waitlist_open                      boolean default true not null,
  primary key (id)
);
grant select, insert, update, delete on public.events to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.faces_reels (
  id                                 uuid default gen_random_uuid() not null,
  created_at                         timestamp with time zone default now() not null,
  name                               text not null,
  url                                text not null,
  caption                            text,
  active                             boolean default true not null,
  pinned                             boolean default false not null,
  primary key (id)
);
grant select, insert, update, delete on public.faces_reels to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.members (
  id                                 uuid default gen_random_uuid() not null,
  created_at                         timestamp with time zone default now(),
  full_name                          text not null,
  email                              text,
  phone                              text,
  gender                             text,
  location                           text,
  eligibility                        jsonb,
  details                            jsonb,
  status                             text default 'pending',
  amount                             integer,
  currency                           text default 'aed',
  stripe_session_id                  text,
  paid_at                            timestamp with time zone,
  invite_token                       text,
  invite_used_at                     timestamp with time zone,
  invite_expires_at                  timestamp with time zone,
  abandoned_at                       timestamp with time zone,
  invite_opened_at                   timestamp with time zone,
  abandoned_reminder_sent_at         timestamp with time zone,
  primary key (id)
);
grant select, insert, update, delete on public.members to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.milestones (
  id                                 uuid default gen_random_uuid() not null,
  created_at                         timestamp with time zone default now() not null,
  year_label                         text not null,
  title                              text not null,
  body                               text default '' not null,
  sort_order                         integer default 0 not null,
  published                          boolean default true not null,
  primary key (id)
);
grant select, insert, update, delete on public.milestones to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.operating_costs (
  id                                 uuid default gen_random_uuid() not null,
  created_at                         timestamp with time zone default now() not null,
  incurred_on                        date not null,
  category                           text default 'other' not null,
  description                        text not null,
  amount_aed                         numeric default 0 not null,
  event_id                           uuid,
  notes                              text,
  primary key (id)
);
grant select, insert, update, delete on public.operating_costs to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.payments (
  id                                 uuid default gen_random_uuid() not null,
  created_at                         timestamp with time zone default now() not null,
  paid_at                            timestamp with time zone not null,
  kind                               text not null,
  description                        text,
  reference_id                       uuid,
  event_id                           uuid,
  gross_aed                          numeric default 0 not null,
  revenue_aed                        numeric default 0 not null,
  fee_passed_on_aed                  numeric default 0 not null,
  stripe_fee_aed                     numeric default 0 not null,
  refunded_aed                       numeric default 0 not null,
  currency                           text default 'aed' not null,
  stripe_session_id                  text,
  stripe_charge_id                   text,
  source                             text default 'webhook' not null,
  primary key (id)
);
grant select, insert, update, delete on public.payments to service_role;

-- ------------------------------------------------------------------------
create table if not exists public.testimonials (
  id                                 uuid default gen_random_uuid() not null,
  created_at                         timestamp with time zone default now() not null,
  reviewed_at                        timestamp with time zone,
  name                               text not null,
  headline                           text,
  quote                              text not null,
  rating                             smallint default 5 not null,
  status                             text default 'pending' not null,
  business_id                        uuid,
  reviewer_email                     text,
  reviewer_phone                     text,
  primary key (id)
);
grant select, insert, update, delete on public.testimonials to service_role;

-- ------------------------------------------------------------------------
-- Foreign keys, added once every table above exists.

do $$ begin
  alter table public.business_testimonials add constraint business_testimonials_business_id_fkey
    foreign key (business_id) references public.business_submissions(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.directory_events add constraint directory_events_business_id_fkey
    foreign key (business_id) references public.business_submissions(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.event_registrations add constraint event_registrations_event_id_fkey
    foreign key (event_id) references public.events(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.event_registrations add constraint event_registrations_ticket_id_fkey
    foreign key (ticket_id) references public.event_tickets(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.event_tickets add constraint event_tickets_event_id_fkey
    foreign key (event_id) references public.events(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.event_waitlist add constraint event_waitlist_event_id_fkey
    foreign key (event_id) references public.events(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.operating_costs add constraint operating_costs_event_id_fkey
    foreign key (event_id) references public.events(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.payments add constraint payments_event_id_fkey
    foreign key (event_id) references public.events(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.testimonials add constraint testimonials_business_id_fkey
    foreign key (business_id) references public.business_submissions(id);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------------
-- NOT IN THIS FILE: indexes, unique and check constraints, RLS policies and
-- functions. The API cannot describe them. Run supabase/schema-extras-query.sql
-- in the Supabase SQL editor and save its output as supabase/schema-extras.sql.
-- A restore needs both files: this one first, then that one.

