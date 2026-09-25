-- Tracks when an admin manually sent a "come finish your application" nudge
-- email to an abandoned (status='pending') join applicant. Run this in the
-- Supabase SQL editor.

ALTER TABLE members ADD COLUMN IF NOT EXISTS abandoned_reminder_sent_at timestamptz NULL;
