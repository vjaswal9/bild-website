-- Child tickets: ask the buyer how old the child is.
--
-- Some events need ages on the door list, for licensing, catering, seating or
-- age-banded activities. A ticket called "Child" tells you a child is coming;
-- it does not tell you whether they are three or thirteen, which is usually
-- the part that matters.
--
-- Marking a ticket as a child ticket makes the booking form ask for an age for
-- each person on that ticket, and refuse the booking without one.
--
-- Run this in the Supabase SQL editor.

-- Set per ticket type, by an admin, on the event's Tickets section.
alter table public.event_tickets
  add column if not exists is_child boolean not null default false;

-- The lead booker's age, used only when the lead booker is themselves on a
-- child ticket. Everyone else's age is stored against them inside the
-- guest_names jsonb, alongside their name and package, because that is where
-- the rest of a guest's details already live.
alter table public.event_registrations
  add column if not exists attendee_age smallint
  check (attendee_age is null or (attendee_age >= 0 and attendee_age <= 17));

-- VERIFY: both should return a row.
select column_name, data_type from information_schema.columns
where table_name = 'event_tickets' and column_name = 'is_child';

select column_name, data_type from information_schema.columns
where table_name = 'event_registrations' and column_name = 'attendee_age';
