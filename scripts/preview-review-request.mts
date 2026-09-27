// Renders the real post-event review request email without sending it.
//
//   npx tsx scripts/preview-review-request.mts
//
// Requests to Resend are answered locally, so nothing is ever delivered. Uses
// the live GOOGLE_PLACE_ID so the button points at the real review link.
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]))
for (const [k, v] of Object.entries(env)) process.env[k] ||= v as string
process.env.RESEND_API_KEY ||= 're_preview_only'

const captured: { to: string; subject: string; html: string }[] = []
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input?.url ?? String(input)
  if (url.includes('api.resend.com')) {
    const body = JSON.parse(init?.body ?? '{}')
    captured.push({ to: String(body.to), subject: body.subject, html: body.html })
    return new Response(JSON.stringify({ id: 'preview-only' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return realFetch(input, init)
}) as typeof fetch

const { sendEventReviewRequest } = await import('../src/lib/email')
const reviewUrl = `https://search.google.com/local/writereview?placeid=${process.env.GOOGLE_PLACE_ID}`

// The two real events tomorrow's batch draws from.
await sendEventReviewRequest({ to: 'preview@example.com', firstName: 'Sharon', eventTitle: 'BILD Ladies Night September 2026', reviewUrl })
await sendEventReviewRequest({ to: 'preview@example.com', firstName: 'Birju', eventTitle: 'BILD Lads Evening Brunch - Sept 2026', reviewUrl })
// No first name on the booking: check the greeting still reads properly.
await sendEventReviewRequest({ to: 'preview@example.com', eventTitle: 'BILD Ladies Night September 2026', reviewUrl })

const labels = ['Ladies Night attendee', 'Lads Brunch attendee', 'No first name on the booking']
const page = captured.map((c, i) => `
  <div style="max-width:560px;margin:0 auto 12px;background:#fff;border-radius:10px;padding:13px 16px;font-family:Arial,sans-serif">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888">${labels[i]} &middot; inbox preview</div>
    <div style="font-size:15px;font-weight:bold;color:#111;margin-top:3px">${c.subject}</div>
  </div>${c.html}
  <div style="height:40px"></div>`).join('')

const out = process.argv[2] || '/tmp/review-request-preview.html'
fs.writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>BILD review request email</title>
  <body style="margin:0;background:#8d8d8d;padding:22px">${page}</body>`)
console.log('rendered', captured.length, 'variants ->', out)
captured.forEach((c, i) => console.log(`  ${labels[i]}: "${c.subject}"`))
console.log('review link in body:', captured[0].html.includes(reviewUrl) ? 'yes' : 'NO')
console.log('greeting with no name:', /Hi (\w+),/.exec(captured[2].html)?.[1])
