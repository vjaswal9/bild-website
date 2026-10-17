// Quick health check of a running copy of the site (read-only: GET requests only).
//
//   node scripts/smoke.mjs                          checks http://localhost:3000
//   node scripts/smoke.mjs https://www.bild.ae      checks the live site
//
// For a local run, start the site first (npm run dev, or npm run build then
// npm start). Exits with a non-zero code if anything below fails.

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '')
let failed = 0

const ok = (pass, msg) => {
  if (!pass) failed++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${msg}`)
}

async function get(path) {
  const res = await fetch(base + path, { redirect: 'manual' })
  return { status: res.status, headers: res.headers, text: await res.text() }
}

// 1. Every public page loads, has a title, and has exactly one <h1>.
const pages = [
  '/', '/events', '/directory', '/join', '/about', '/contact', '/photo-vault',
  '/knowledge-base', '/faces-of-bild', '/testimonials', '/testimonials/submit',
  '/directory/submit', '/directory/get-featured', '/terms', '/privacy',
  '/refund-policy', '/code-of-conduct',
]
for (const p of pages) {
  const r = await get(p)
  const h1s = (r.text.match(/<h1[\s>]/g) || []).length
  const title = /<title>[^<]+<\/title>/.test(r.text)
  ok(r.status === 200 && title && h1s === 1, `${p}: ${r.status}, title ${title ? 'yes' : 'NO'}, h1 x${h1s}`)
}

// 2. Basics every page should carry.
const home = await get('/')
ok(/href="#main"/.test(home.text) && /<main id="main"/.test(home.text), 'skip-to-content link and main landmark present')
ok(/<html lang="en"/.test(home.text), 'html lang is set')
ok(!/<img(?![^>]*\balt=)/.test(home.text), 'every <img> on the home page has an alt attribute')

// The old Community Rules address must still reach the renamed page.
const old = await get('/community-rules')
ok((old.status === 308 || old.status === 301) && /\/code-of-conduct$/.test(old.headers.get('location') || ''), '/community-rules redirects to /code-of-conduct')

// 3. Personal one-time links must not be indexable.
for (const p of ['/events/upgrade/x', '/directory/pay/x', '/directory/renew/x', '/directory/manage/x', '/directory/feature/x']) {
  const r = await get(p)
  ok(/noindex/.test(r.text), `${p} is marked noindex`)
}

// 4. Admin and private areas are closed to visitors who are not signed in.
for (const p of ['/admin', '/admin/events', '/admin/money']) {
  const r = await get(p)
  ok(r.status === 307 || r.status === 308 || r.status === 302 || r.status === 401, `${p} redirects or refuses when signed out (${r.status})`)
}
for (const p of ['/api/admin/events/finances?eventId=x']) {
  const r = await get(p)
  ok(r.status === 401 || r.status === 403 || r.status === 307, `${p} is not readable when signed out (${r.status})`)
}

// 5. Crawler files.
const robots = await get('/robots.txt')
ok(robots.status === 200 && /Disallow: \/admin/.test(robots.text), 'robots.txt blocks /admin')
const sitemap = await get('/sitemap.xml')
ok(sitemap.status === 200 && /<urlset/.test(sitemap.text), 'sitemap.xml is served')

// 6. Every internal link on the home page resolves.
const links = [...new Set([...home.text.matchAll(/href="(\/[^"#?]*)"/g)].map(m => m[1]))]
  .filter(h => !h.startsWith('/_next') && !h.startsWith('/api'))
for (const l of links) {
  const r = await get(l)
  ok(r.status < 400 || r.status === 307 || r.status === 308, `home links to ${l}: ${r.status}`)
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
