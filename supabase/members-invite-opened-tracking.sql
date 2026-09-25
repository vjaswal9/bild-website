-- Tracks the first time a member's single-use WhatsApp invite link was
-- opened, separate from invite_used_at (which now only fires when they
-- actually click through to join, not just when the page loads). This
-- catches email security scanners (e.g. Microsoft Safe Links on
-- Outlook/Hotmail) that pre-fetch links and would otherwise silently burn
-- a single-use invite before the real recipient ever sees it.
alter table public.members add column if not exists invite_opened_at timestamptz;
