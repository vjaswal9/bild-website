-- Records when the Stripe import was last run, so the Money dashboard can
-- show it under the "Import from Stripe" button.
--
-- Stored on admin_settings (the existing single-row settings table) rather
-- than derived from the ledger, because an import that finds nothing new
-- writes no ledger rows but is still an import that happened.
alter table public.admin_settings
  add column if not exists last_stripe_import_at timestamptz;
