-- Lets an admin actually collect the difference when someone upgrades to a
-- more expensive ticket. Stripe cannot charge more to a card that has
-- already been used, so this is a fresh, token-gated payment link (the same
-- pattern as the business directory's listing-payment link) rather than an
-- automatic charge.
--
-- upgrade_due_aed is null whenever nothing is owed - cleared the moment the
-- difference is paid, or never set at all for a booking that has never been
-- upgraded.
--
-- Run this in the Supabase SQL editor.

alter table public.event_registrations
  add column if not exists upgrade_due_aed numeric,
  add column if not exists upgrade_payment_token text,
  add column if not exists upgrade_payment_token_expires_at timestamptz,
  add column if not exists upgrade_note text;
