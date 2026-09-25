import { NextResponse } from 'next/server'

// The pages a member lands on after tapping their WhatsApp invite.
//
// Shared between /j/[token] and /j/[token]/confirm, which previously carried
// two near-identical copies and so could drift apart. They are the last thing
// a brand new member sees, and until now the unhappy ones simply stated a fact
// and offered an email address - which is precisely how they ended up as
// messages to an admin at eleven at night.
//
// The rule applied here: say what has happened, say whether anything is wrong,
// and say what to do next. "Link already used" answers none of those.

type Tone = 'good' | 'neutral' | 'problem'

const GOLD = '#C8861A'

export function invitePage(opts: {
  title: string
  lead: string
  detail?: string
  tone?: Tone
  cta?: { href: string; label: string }
  showContact?: boolean
}) {
  const tone = opts.tone || 'neutral'
  const accent = tone === 'problem' ? '#9B2335' : GOLD
  const badge = tone === 'good' ? '🎉' : tone === 'problem' ? '' : '👍'

  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.title} | BILD</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#fdf8f0;color:#2E2E2E;
       display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;line-height:1.6}
  .card{max-width:460px;width:100%;background:#fff;border:1px solid #f4d99b;border-radius:18px;padding:34px 30px;text-align:center;
        box-shadow:0 6px 24px rgba(20,20,20,0.05)}
  .eyebrow{color:${GOLD};font-size:11px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;margin:0 0 10px}
  h1{font-family:Georgia,serif;color:${accent};font-size:25px;margin:0 0 12px;line-height:1.25}
  p{margin:0 0 14px;font-size:15px;color:#4a4a4a}
  .detail{background:#fdf8f0;border:1px solid #f4d99b;border-radius:12px;padding:14px 16px;font-size:14px;color:#4a4a4a;text-align:left;margin:18px 0 0}
  .btn{display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:16px;
       padding:15px 30px;border-radius:12px;margin:8px 0 4px}
  .contact{margin:22px 0 0;font-size:13.5px;color:#6b6b6b}
  a{color:${GOLD}}
  .foot{margin:26px 0 0;padding-top:16px;border-top:1px solid #f0e6d2;font-size:11.5px;color:#9a958c}
</style></head>
<body><div class="card">
  <p class="eyebrow">BILD${badge ? ' &middot; ' + badge : ''}</p>
  <h1>${opts.title}</h1>
  <p>${opts.lead}</p>
  ${opts.cta ? `<p><a class="btn" href="${opts.cta.href}">${opts.cta.label}</a></p>` : ''}
  ${opts.detail ? `<div class="detail">${opts.detail}</div>` : ''}
  ${opts.showContact === false || (opts.detail || '').includes('connect@bild.ae')
      ? ''
      : `<p class="contact">Still stuck? Email <a href="mailto:connect@bild.ae">connect@bild.ae</a> and we will sort it out.</p>`}
  <p class="foot">British Indians Living in Dubai &middot; Established 2019</p>
</div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

// --------------------------------------------------------------------------
// The shared outcomes. Both routes call these, so the two cannot drift.

/** The single most common landing, and the one that generated the messages. */
export const alreadyUsedPage = () =>
  invitePage({
    title: 'You have already used this link',
    tone: 'neutral',
    lead:
      'That is completely normal and nothing has gone wrong. Each invite works once, so it stops ' +
      'working the moment you tap it.',
    detail:
      '<strong>If you tapped through to WhatsApp and sent your request:</strong> you are in the queue. ' +
      'One of our admins approves every person by hand, which can take up to 48 hours. The BILD groups ' +
      'will appear in your WhatsApp once you are approved - there is nothing else for you to do.' +
      '<br><br>' +
      '<strong>If you never reached WhatsApp:</strong> email <a href="mailto:connect@bild.ae">connect@bild.ae</a> and we will send a fresh link the same day. ' +
      'Your membership is safe either way.',
  })

/** They never got to use it. This one genuinely needs a new link. */
export const expiredPage = () =>
  invitePage({
    title: 'This link has expired',
    tone: 'neutral',
    lead:
      'Invites are valid for 48 hours, and this one has passed that. Your membership is completely ' +
      'unaffected - only the link has lapsed.',
    detail:
      'Email <a href="mailto:connect@bild.ae">connect@bild.ae</a> and we will send you a fresh invite the ' +
      'same day. If you did already tap through to WhatsApp before it lapsed, you may simply be waiting on ' +
      'admin approval, which takes up to 48 hours.',
  })

export const invalidPage = () =>
  invitePage({
    title: 'We do not recognise this link',
    tone: 'problem',
    lead:
      'This is not a link we issued. It may have been copied incompletely, or shortened by a messaging app ' +
      'along the way.',
    detail:
      'Open the original welcome email from BILD and tap the green button there, rather than copying the ' +
      'address by hand. If that still does not work, email us and we will send a fresh one.',
  })

export const notPaidPage = () =>
  invitePage({
    title: 'We cannot confirm your payment yet',
    tone: 'problem',
    lead:
      'Card payments occasionally take a few minutes to settle. If you have just paid, wait five minutes ' +
      'and tap your link again.',
    detail:
      'If it has been longer than that, email us with the name and email address you joined under and we ' +
      'will check it straight away. Nothing is lost.',
  })

export const groupNotConfiguredPage = () =>
  invitePage({
    title: 'Almost there',
    tone: 'neutral',
    lead:
      'Your membership is confirmed, but the WhatsApp group link is not set up at our end yet.',
    detail:
      'This one is on us, not you. Email connect@bild.ae and we will add you to the community by hand today.',
  })
