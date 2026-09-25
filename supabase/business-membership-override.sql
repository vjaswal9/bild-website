-- Lets an admin manually mark a business's self-declared BILD membership as
-- verified, overriding the automated email/phone match against the paid
-- members table - for cases like a member who hasn't been imported yet
-- (e.g. still sitting in a spreadsheet).
ALTER TABLE business_submissions ADD COLUMN IF NOT EXISTS membership_manually_verified boolean NOT NULL DEFAULT false;
