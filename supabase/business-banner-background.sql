-- Lets an admin override how a banner is displayed.
--
-- NULL / 'auto' : decide automatically - a transparent image goes on white,
--                 anything else on the dark blurred treatment.
-- 'light'       : always white. Use for a dark or colourful logo.
-- 'dark'        : always dark. Use for a pale or white logo, which would
--                 otherwise disappear against white.
--
-- Run this in the Supabase SQL editor.

ALTER TABLE business_submissions
  ADD COLUMN IF NOT EXISTS banner_bg text NULL;
