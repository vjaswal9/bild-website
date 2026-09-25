// Renders the real welcome email to /tmp/real-preview.html without sending it.
//
//   npx tsx scripts/preview-welcome-email.mts
//
// Requests to Resend are answered locally, so nothing is ever delivered.
// Google Places is allowed through, so the review badge shows live figures.
// Renders both branches: with an invite link, and the manual-add fallback.
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]))
for (const [k, v] of Object.entries(env)) process.env[k] ||= v as string
process.env.RESEND_API_KEY ||= 're_preview_only'
process.env.NEXT_PUBLIC_SITE_URL ||= 'https://www.bild.ae'

const captured: { subject: string; html: string }[] = []

// Intercept at the network layer rather than stubbing Resend's internals.
// Guaranteed to work whatever the SDK does inside, and it proves nothing is
// actually delivered: any request to Resend is answered locally and never
// leaves the machine. Google Places calls are allowed through so the badge
// shows real figures.
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input?.url ?? String(input)
  if (url.includes('api.resend.com')) {
    const body = JSON.parse(init?.body ?? '{}')
    captured.push({ subject: body.subject, html: body.html })
    return new Response(JSON.stringify({ id: 'preview-only' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }
  return realFetch(input, init)
}) as typeof fetch

const { sendWelcomeEmail } = await import('../src/lib/email')

// 1. the normal path
await sendWelcomeEmail({
  to: 'preview@example.com', name: 'Priya Sharma',
  inviteUrl: 'https://www.bild.ae/j/EXAMPLE-TOKEN',
  amountAed: 50, receiptUrl: 'https://pay.stripe.com/receipts/EXAMPLE',
})
// 2. the fallback, no invite token
await sendWelcomeEmail({ to: 'preview@example.com', name: 'Priya Sharma', amountAed: 50 })

const label = ['WITH invite link', 'FALLBACK: no invite link']
const page = captured.map((c, i) => `
  <div style="max-width:560px;margin:0 auto 12px;background:#fff;border-radius:10px;padding:13px 16px;font-family:Arial,sans-serif">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888">${label[i]} &middot; inbox preview</div>
    <div style="font-size:15px;font-weight:bold;color:#111;margin-top:3px">${c.subject}</div>
  </div>${c.html}
  <div style="height:40px"></div>`).join('')

fs.writeFileSync('/tmp/real-preview.html',
  `<!doctype html><meta charset="utf-8"><title>BILD welcome email (real output)</title>
   <body style="margin:0;background:#8d8d8d;padding:22px">${page}</body>`)
console.log('rendered', captured.length, 'variants')
console.log('subjects:'); captured.forEach(c => console.log('  -', c.subject))
console.log('event section present in v1:', captured[0].html.includes("Next up"))
console.log('google badge present in v1 :', captured[0].html.includes('Google reviews'))
console.log('receipt link present in v1 :', captured[0].html.includes('payment receipt'))
console.log('five steps in v1           :', (captured[0].html.match(/border-radius:50%/g) || []).length)
console.log('five steps in FALLBACK     :', (captured[1].html.match(/border-radius:50%/g) || []).length, '(should be 0)')
