-- ============================================================
-- FEATURED BROCHURE
--
-- Featured listings (only) can offer visitors a PDF brochure to download
-- from their directory profile. The file itself lives in the public
-- business-logos storage bucket under brochures/; these columns record
-- where it is and the name to show on the download button.
-- ============================================================

alter table public.business_submissions
  add column if not exists featured_brochure_url  text,
  add column if not exists featured_brochure_name text;
