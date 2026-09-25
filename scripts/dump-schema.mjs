// Writes supabase/schema.sql from the live database.
//
// The weekly members-backup cron saves the DATA. Nothing saved the STRUCTURE,
// so if the Supabase project were ever lost there would be rows in a
// spreadsheet and no tables to load them into. members and business_submissions
// - the two most important tables on the site - had no create table statement
// anywhere in this repo.
//
// Reads PostgREST's OpenAPI description, which is the live schema as the API
// sees it. Run after any migration:
//
//   node scripts/dump-schema.mjs
//
// Covers columns, types, defaults, NOT NULL, primary keys and foreign keys.
// Indexes, unique constraints, check constraints, triggers and RLS policies are
// NOT visible through this API - the query printed at the end of schema.sql
// collects those from the SQL editor.
import fs from 'fs'
import path from 'path'

const root = path.resolve(import.meta.dirname, '..')
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_KEY
if (!URL || !KEY) { console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be in .env.local'); process.exit(1) }

const res = await fetch(`${URL}/rest/v1/`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
if (!res.ok) { console.error('Could not read the schema:', res.status, await res.text()); process.exit(1) }
const defs = (await res.json()).definitions || {}

const TEXTISH = /^(text|character varying|character|citext|uuid|date|time|timestamp)/

// PostgREST reports a default as the raw value, so a text default arrives as
// `pending` rather than `'pending'`. Written back unquoted it is read as a
// column reference and the DDL fails to run - which would only be discovered
// during the recovery this file exists for.
function formatDefault(raw, type) {
  const v = String(raw)
  if (/^'.*'$/.test(v)) return v                       // already quoted
  if (/\(\)|\(.*\)/.test(v)) return v                  // now(), gen_random_uuid()
  if (/^(true|false|null)$/i.test(v)) return v
  // Bare SQL keywords. CURRENT_DATE has no parentheses, so without this it was
  // quoted into the string 'CURRENT_DATE' and the restore would fail casting it
  // to a date - the sort of error only found during the emergency this file is
  // for.
  if (/^(current_date|current_timestamp|current_time|current_user|session_user|localtime|localtimestamp)$/i.test(v)) return v
  if (/^-?\d+(\.\d+)?$/.test(v)) return v              // numeric
  if (/^ARRAY\[|^'\{.*\}'/.test(v)) return v           // array literal
  if (TEXTISH.test(type)) return `'${v.replace(/'/g, "''")}'`
  return v
}

const out = []
const today = new Date().toISOString().slice(0, 10)
out.push(`-- BILD database schema, generated from the live project on ${today}.`)
out.push('--')
out.push('-- Regenerate with:  node scripts/dump-schema.mjs')
out.push('--')
out.push('-- WHY THIS EXISTS: the weekly members-backup cron saves the data; nothing')
out.push('-- saved the structure. members and business_submissions had no create table')
out.push('-- statement anywhere in this repo, so the backup spreadsheet had nowhere to')
out.push('-- be restored to.')
out.push('--')
out.push('-- COVERS: columns, types, defaults, NOT NULL, primary keys, foreign keys.')
out.push('-- DOES NOT COVER: indexes, unique constraints beyond the primary key, check')
out.push('-- constraints, triggers, functions and RLS policies. The query at the bottom')
out.push('-- of this file collects those from the Supabase SQL editor.')
out.push('--')
out.push('-- Grants are explicit. From 30 October 2026 Supabase no longer grants Data')
out.push('-- API access to new tables automatically, so a rebuild without these would')
out.push('-- produce tables the site cannot read. service_role only, deliberately: the')
out.push('-- anon key ships in every page of the site and must never reach these.')
out.push('')

const names = Object.keys(defs).sort()
const allFks = []
for (const t of names) {
  const def = defs[t]
  const required = new Set(def.required || [])
  const cols = [], pks = [], fks = []
  for (const [c, p] of Object.entries(def.properties || {})) {
    const type = p.format || p.type
    const parts = [`  ${c.padEnd(34)} ${type}`]
    if (p.default !== undefined) parts.push(`default ${formatDefault(p.default, type)}`)
    if (required.has(c)) parts.push('not null')
    cols.push(parts.join(' '))
    const desc = p.description || ''
    if (desc.includes('<pk/>')) pks.push(c)
    const fk = desc.match(/<fk table='([^']+)' column='([^']+)'\/>/)
    if (fk) fks.push([c, fk[1], fk[2]])
  }
  const body = [...cols]
  if (pks.length) body.push(`  primary key (${pks.join(', ')})`)

  out.push(`-- ${'-'.repeat(72)}`)
  out.push(`create table if not exists public.${t} (`)
  out.push(body.join(',\n'))
  out.push(');')
  out.push(`grant select, insert, update, delete on public.${t} to service_role;`)
  out.push('')

  // Collected, not inlined - see below.
  for (const [c, ft, fc] of fks) allFks.push([t, c, ft, fc])
}

// Foreign keys go last, once every table exists.
//
// Inlined in the create table they broke the restore: the tables are written
// alphabetically, so event_registrations was created before events and
// event_tickets, and its references failed. Adding them afterwards removes the
// ordering problem entirely rather than relying on a sort that a future table
// could quietly invalidate.
if (allFks.length) {
  out.push(`-- ${'-'.repeat(72)}`)
  out.push('-- Foreign keys, added once every table above exists.')
  out.push('')
  for (const [t, c, ft, fc] of allFks) {
    const name = `${t}_${c}_fkey`
    out.push('do $$ begin')
    out.push(`  alter table public.${t} add constraint ${name}`)
    out.push(`    foreign key (${c}) references public.${ft}(${fc});`)
    out.push('exception when duplicate_object then null; end $$;')
  }
  out.push('')
}

out.push(`-- ${'-'.repeat(72)}`)
out.push('-- NOT IN THIS FILE: indexes, unique and check constraints, RLS policies and')
out.push('-- functions. The API cannot describe them. Run supabase/schema-extras-query.sql')
out.push('-- in the Supabase SQL editor and save its output as supabase/schema-extras.sql.')
out.push('-- A restore needs both files: this one first, then that one.')
out.push('')

fs.writeFileSync(path.join(root, 'supabase/schema.sql'), out.join('\n') + '\n')
console.log(`wrote supabase/schema.sql - ${names.length} tables`)
