-- ============================================================
-- 1. MILESTONES
--    The About page timeline, moved out of code and into the
--    database so it can be edited in the admin area and go live
--    immediately, instead of needing a deploy every time.
-- ============================================================
create table if not exists public.milestones (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  -- Free text rather than a number: real entries span ranges ("2020 - 2022").
  year_label  text not null,
  title       text not null,
  body        text not null default '',
  sort_order  integer not null default 0,
  published   boolean not null default true
);

create index if not exists milestones_sort_idx on public.milestones(sort_order);

-- RLS: locked to the public anon key, matching every other table in this
-- schema. Enabled immediately after the table is created, both so the
-- Supabase SQL editor does not flag the script and so the table is never
-- left open. The seed below still runs: row level security is not enforced
-- against the table owner, which is who the SQL editor connects as.
alter table public.milestones enable row level security;

-- Seed with what is on the site today, so nothing disappears when the page
-- switches over. Runs once: if the table already has any rows, this inserts
-- nothing, so the whole script is safe to run again.
insert into public.milestones (year_label, title, body, sort_order)
select s.year_label, s.title, s.body, s.sort_order
from (
  select '2019'::text as year_label,
         'BILD begins in Dubai'::text as title,
         'Truna Jaswal starts BILD around one idea: that nobody arriving in a new city should have to work out how to belong on their own. It begins as a handful of British Indians meeting up, and a single group chat. The first Karwa Chauth gathering takes place.'::text as body,
         10 as sort_order
  union all select '2020 - 2022' as year_label,
         'One group chat becomes many' as title,
         'Word spreads the way it does in a community like this, through friends and family. The single chat becomes specialist groups, because people want to talk about schools, property, jobs and food with the people who already know the answers. The first Diwali event takes place!' as body,
         20 as sort_order
  union all select '2023' as year_label,
         'A licensed business' as title,
         'BILD is licensed by the Dubai Department of Economy and Tourism as B.I.L.D AE Events Organizing & Managing. What started between friends becomes a properly constituted UAE business.' as body,
         30 as sort_order
  union all select '2023 - 2024' as year_label,
         'The calendar takes shape' as title,
         'Diwali celebrations, Garba nights, ladies nights, lads brunches, coffee mornings and family days settle into a regular rhythm across Dubai, from Kite Beach to Arabian Ranches Golf Club.' as body,
         40 as sort_order
  union all select '2025' as year_label,
         'Diwali Dhamaka' as title,
         'BILD takes over Al Habtoor Polo Resort for Diwali Dhamaka, with special guest singer H. Dhami. One of its largest gatherings to date.' as body,
         50 as sort_order
  union all select '2026' as year_label,
         'The Business Directory opens' as title,
         'BILD launches a directory of British Indian businesses across the UAE and UK, giving members somewhere to find people they can deal with, and giving founders a way to reach the community. It opens with 27 businesses across 14 categories.' as body,
         60 as sort_order
) as s
where not exists (select 1 from public.milestones);

-- ============================================================
-- 2. PARTIAL REFUNDS ON A BOOKING
--    Until now a booking was either fully refunded or not at all.
--    A partial refund (one guest drops out, or a ticket is
--    downgraded) leaves the booking live and the person still
--    attending, so it is recorded as an amount rather than a
--    status change.
-- ============================================================
alter table public.event_registrations
  add column if not exists refunded_amount_aed numeric(10,2) not null default 0;

-- A short audit note explaining why: "Downgraded to soft drinks", "Guest
-- cancelled". Shown in the admin list so the reason is not lost.
alter table public.event_registrations
  add column if not exists admin_note text;
