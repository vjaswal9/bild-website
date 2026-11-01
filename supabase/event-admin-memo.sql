-- ============================================================
-- ADMIN MEMO on bookings and waiting-list entries
--
-- A short private label an admin types against a booking or a waiting-list
-- entry ("VIP, seat near stage", "friend of Raj", "call before offering").
-- Capped at 45 characters, in the database as well as the form.
--
-- This is separate from admin_note, which is the automatic audit trail
-- (refunds, ticket changes, imports) and can run to many lines. Keeping them
-- apart means a person typing never has to edit around the system's own log.
--
-- Additive and safe to run more than once. Both tables already have row level
-- security on with no policies, so this column is not readable with the public
-- anon key; it is only ever read and written by the admin routes.
-- ============================================================

alter table public.event_registrations
  add column if not exists admin_memo text;

alter table public.event_waitlist
  add column if not exists admin_memo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'event_registrations_admin_memo_len') then
    alter table public.event_registrations
      add constraint event_registrations_admin_memo_len
      check (admin_memo is null or char_length(admin_memo) <= 45);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_waitlist_admin_memo_len') then
    alter table public.event_waitlist
      add constraint event_waitlist_admin_memo_len
      check (admin_memo is null or char_length(admin_memo) <= 45);
  end if;
end $$;
