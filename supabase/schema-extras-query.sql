-- Collects everything schema.sql cannot see.
--
-- schema.sql is generated from the PostgREST API, which only describes columns,
-- types, defaults and keys. Indexes, unique and check constraints, RLS and
-- functions are invisible to it - and those are the parts that make the
-- database behave correctly rather than merely exist. Without them a restored
-- copy would be slow, unprotected, and missing record_directory_event.
--
-- HOW TO USE
--   1. Supabase dashboard -> SQL Editor -> New query
--   2. Paste this whole file and Run
--   3. Select the results and copy them
--   4. Send them back, and they get saved as supabase/schema-extras.sql
--
-- One column comes back, one runnable statement per row, already in the order
-- they need to be applied.

select ddl from (

  -- Row level security. Enabled first, so nothing is briefly readable while the
  -- policies below are being created.
  select 1 as ord, tablename as name,
         'alter table public.' || tablename || ' enable row level security;' as ddl
    from pg_tables
   where schemaname = 'public' and rowsecurity

  union all

  -- Indexes, except the ones Postgres creates to back a constraint - those
  -- arrive with the constraint itself and would otherwise be duplicated.
  select 2, i.indexname, i.indexdef || ';'
    from pg_indexes i
   where i.schemaname = 'public'
     and not exists (
       select 1 from pg_constraint c
        where c.conname = i.indexname
          and c.connamespace = 'public'::regnamespace
     )

  union all

  -- Unique, check and foreign key constraints. Primary keys are left out
  -- because schema.sql already declares them inline.
  select 3, conname,
         'alter table ' || conrelid::regclass || ' add constraint ' || conname ||
         ' ' || pg_get_constraintdef(oid) || ';'
    from pg_constraint
   where connamespace = 'public'::regnamespace
     and contype in ('u', 'c', 'f')

  union all

  -- RLS policies, written out in full including WITH CHECK.
  select 4, policyname,
         'create policy "' || policyname || '" on ' || schemaname || '.' || tablename ||
         ' as ' || permissive || ' for ' || cmd ||
         ' to ' || array_to_string(roles, ', ') ||
         coalesce(' using (' || qual || ')', '') ||
         coalesce(' with check (' || with_check || ')', '') || ';'
    from pg_policies
   where schemaname = 'public'

  union all

  -- Functions, including record_directory_event and prune_directory_dedupe,
  -- which the directory statistics depend on.
  select 5, proname, pg_get_functiondef(oid) || ';'
    from pg_proc
   where pronamespace = 'public'::regnamespace
     and prokind = 'f'

) x
order by ord, name;
