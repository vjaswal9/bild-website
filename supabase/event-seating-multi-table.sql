-- Lets a seating group be assigned more than one table, for a group bigger
-- than any single table can seat. The admin picks however many table numbers
-- the group needs (e.g. Tables 3 and 4 for 11 people on 5-seat tables) and
-- the group sorts out who sits where once they're at the event - nothing here
-- tracks individual seats.
--
-- seating_table was always admin-only annotation (nothing in the booking flow
-- reads or writes it), so converting it in place is safe: existing single
-- values become one-element arrays, nothing is lost.
--
-- Run this in the Supabase SQL editor.

alter table public.event_registrations
  alter column seating_table type integer[]
  using case when seating_table is null then null else array[seating_table] end;
