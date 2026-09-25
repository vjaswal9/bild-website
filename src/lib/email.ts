import { Resend } from 'resend'
import { getGoogleReviews } from './google-reviews'
import { supabaseRead } from './supabase-admin'
import * as Sentry from '@sentry/nextjs'
import type { GuestEntry } from './events'
import { originEstimateText } from './name-origin'
import { googleCalendarUrl } from './calendar'

// Escape user-supplied text before interpolating into HTML email bodies.
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Welcome email is optional: only sends if RESEND_API_KEY is configured.
const apiKey = process.env.RESEND_API_KEY
const FROM = process.env.RESEND_FROM || 'BILD <connect@bild.ae>'
// Where admin alerts go. Supports multiple recipients: set ADMIN_ALERT_EMAIL to
// a comma-separated list (e.g. "a@x.com, b@y.com"). Falls back to the contact inbox.
const list = (value?: string) =>
  (value || '').split(',').map(s => s.trim()).filter(Boolean)

// The owner's own address, added to every internal alert on top of whatever
// the inbox lists already contain.
//
// A separate variable rather than an entry in the two lists below, because
// Vercel hides the value of an existing secret: rewriting ADMIN_ALERT_EMAIL to
// add one name would have meant guessing at the others and risking dropping
// somebody silently. Leave it unset and nothing changes.
const OWNER_ALERT_EMAILS = list(process.env.OWNER_ALERT_EMAIL)

// Deduplicated, so an address that appears in both lists is not sent twice.
const withOwner = (base: string[]) => Array.from(new Set([...base, ...OWNER_ALERT_EMAILS]))

const ADMIN_ALERT_EMAILS = withOwner(list(process.env.ADMIN_ALERT_EMAIL).length
  ? list(process.env.ADMIN_ALERT_EMAIL)
  : ['connect@bild.ae'])

// Events have their own inbox. A ticket holder who replies to a confirmation
// reaches the people running the event rather than general enquiries, and
// ticket sale alerts land there too.
//
// Sending works for any address on a verified domain, so events@bild.ae needs
// no separate Resend setup. It does need to exist as a real mailbox to RECEIVE
// the admin alerts.
const EVENTS_FROM = process.env.RESEND_EVENTS_FROM || 'BILD Events <events@bild.ae>'
const EVENTS_ALERT_EMAILS = withOwner(list(process.env.EVENTS_ALERT_EMAIL).length
  ? list(process.env.EVENTS_ALERT_EMAIL)
  : ['events@bild.ae'])

// The next event that has not happened yet, or null when nothing is coming up.
//
// Read through supabaseRead rather than supabaseAdmin: this is data already
// public on /events, and the admin client's no-store fetch wrapper would be
// wasted here. Any failure returns null and the email simply omits the section,
// because a welcome email must never fail over a nice-to-have panel.
async function nextUpcomingEvent(): Promise<{ title: string; slug: string; venue: string | null; whenLabel: string } | null> {
  const { data, error } = await supabaseRead
    .from('events')
    .select('title, slug, venue, event_date')
    .eq('status', 'published')
    .gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return {
    title: data.title,
    slug: data.slug,
    venue: data.venue,
    whenLabel: new Date(data.event_date).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai',
    }),
  }
}

export async function sendWelcomeEmail(opts: { to: string; name?: string; inviteUrl?: string; gender?: string; amountAed?: number; receiptUrl?: string }) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return } // email disabled until a key is set
  const resend = new Resend(apiKey)
  const first = esc(opts.name?.split(' ')[0] || 'there')
  // Everyone gets the automated single-use invite link (gender only decides
  // which WhatsApp group the link resolves to). manualAdd covers the case where
  // no token was issued and a human has to add them.
  const manualAdd = !opts.inviteUrl
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'
  const feeLine = opts.amountAed != null
    ? `Your ${opts.amountAed} AED membership fee is confirmed.`
    : 'Your 50 AED membership fee is confirmed.'

  // Live figures, both optional. Neither is worth failing a welcome email over,
  // so each is fetched defensively and simply left out when unavailable.
  const [reviews, nextEvent] = await Promise.all([
    getGoogleReviews().catch(() => null),
    nextUpcomingEvent().catch(() => null),
  ])

  const receiptLine = opts.receiptUrl
    ? `<p style="margin:0 0 16px"><a href="${opts.receiptUrl}" style="color:#8a857a;font-size:12.5px;text-decoration:underline">View your payment receipt</a></p>`
    : '<div style="height:6px"></div>'

  // Stars as text characters, not an image. Most clients block images by
  // default, and a broken-image icon in the first screenful is worse than no
  // badge at all.
  const googleBadge = reviews && reviews.totalReviews > 0
    ? `<a href="${reviews.mapsUrl}" style="display:inline-block;background:#1a1a1a;border:1px solid #3a3222;border-radius:999px;padding:9px 16px;text-decoration:none">
         <span style="color:#F4F1EC;font-size:13px;font-weight:bold;vertical-align:middle">${reviews.rating.toFixed(1)}</span>
         <span style="color:#FFC107;font-size:13px;letter-spacing:1px;vertical-align:middle">&nbsp;&#9733;&#9733;&#9733;&#9733;&#9733;&nbsp;</span>
         <span style="color:#8a857a;font-size:12px;vertical-align:middle">${reviews.totalReviews} Google reviews</span>
       </a>`
    : ''

  const stepRow = (n: number, title: string, body: string) => `
    <tr>
      <td width="30" valign="top" style="padding:0 12px 16px 0">
        <div style="width:26px;height:26px;border-radius:50%;background:#C8861A;color:#fff;font-size:13px;font-weight:bold;text-align:center;line-height:26px">${n}</div>
      </td>
      <td valign="top" style="padding:0 0 16px">
        <p style="color:#F4F1EC;font-size:15px;font-weight:bold;margin:2px 0 3px">${title}</p>
        <p style="color:#a8a296;font-size:13.5px;line-height:1.55;margin:0">${body}</p>
      </td>
    </tr>`

  // The five steps exist because of one specific support burden: members tapped
  // the link, landed in the approval queue, went back to the email, saw
  // "already used" and reported the link as broken. Step 3 says outright that
  // this is supposed to happen.
  const whatsappBlock = manualAdd
    ? `
      <div style="background:#14200f;border:1px solid #2c4423;border-radius:14px;padding:22px">
        <p style="color:#25D366;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:bold;margin:0 0 6px">Now for the fun part</p>
        <p style="color:#F4F1EC;font-size:16px;font-weight:bold;line-height:1.45;margin:0 0 8px">We are adding you to the group chat 💬</p>
        <p style="color:#a8a296;font-size:13.5px;line-height:1.6;margin:0">
          One of our admins is adding you to the BILD WhatsApp community by hand. This can take up to 48 hours, so please
          bear with us. Nothing is needed from you, and there is no link to tap: just keep an eye on WhatsApp.
        </p>
        <p style="color:#a8a296;font-size:13.5px;line-height:1.6;margin:12px 0 0">
          Once you are in, come and say hello: your name, where you are from, and how long you have been in Dubai.
        </p>
      </div>`
    : `
      <div style="background:#14200f;border:1px solid #2c4423;border-radius:14px;padding:22px 22px 8px">
        <p style="color:#25D366;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:bold;margin:0 0 6px">Now for the fun part</p>
        <p style="color:#F4F1EC;font-size:16px;font-weight:bold;line-height:1.45;margin:0 0 6px">Let's get you into the group chat 💬</p>
        <p style="color:#a8a296;font-size:13.5px;line-height:1.55;margin:0 0 18px">
          This is where it all happens: the plans, the recommendations, the banter. Here is exactly what to expect, so
          nothing catches you out.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${stepRow(1, 'Tap the green button', 'It confirms your membership and hands you straight over to WhatsApp.')}
          ${stepRow(2, 'WhatsApp asks you to join', 'Tap through and your request goes into the BILD community. You are in the queue now, not in the group just yet.')}
          ${stepRow(3, 'The link then stops working &ndash; and that is meant to happen', 'It is a one-time link, just for you. If you go back to it later it will say <em>already used</em> or <em>expired</em>. That is not a fault and nothing has gone wrong. It simply means it did its job.')}
          ${stepRow(4, 'One of our admins lets you in', 'We approve every single person by hand, so we know exactly who is in our community. This can take up to 48 hours, so please bear with us.')}
          ${stepRow(5, 'The BILD groups appear in your WhatsApp', 'That is you in 🎉 Come and say hello: your name, where you are from, and how long you have been in Dubai.')}
        </table>
        <div style="text-align:center;padding:6px 0 18px">
          <a href="${opts.inviteUrl}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:bold;font-size:16px;padding:15px 30px;border-radius:12px">Join the BILD WhatsApp community</a>
          <p style="color:#6f6a60;font-size:12px;margin:12px 0 0">Works once &middot; Please use it within 48 hours</p>
        </div>
      </div>
      <div style="background:#1a1a1a;border-radius:10px;padding:13px 16px;margin:12px 0 0">
        <p style="color:#a8a296;font-size:12.5px;line-height:1.55;margin:0">
          <strong style="color:#F4F1EC">Seeing &ldquo;expired&rdquo; or &ldquo;already used&rdquo;?</strong> If you have already tapped it once, that is
          completely normal and you are in the queue &ndash; just hang on for admin approval. If you never got the chance to
          use it, email <a href="mailto:connect@bild.ae" style="color:#C8861A;text-decoration:none">connect@bild.ae</a> and we will send a
          fresh link the same day. Your membership is safe either way.
        </p>
      </div>`

  // Omitted entirely when nothing is coming up. An empty "don't miss it" panel
  // would say the opposite of what it is for.
  const eventBlock = nextEvent
    ? `
    <div style="padding:26px 28px 0">
      <div style="background:#241a08;border:1px solid #4a3714;border-radius:14px;padding:22px">
        <p style="color:#C8861A;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:bold;margin:0 0 8px">🔥 Next up &middot; Don't miss it</p>
        <p style="color:#F4F1EC;font-family:Georgia,serif;font-size:21px;margin:0 0 6px">${esc(nextEvent.title)}</p>
        <p style="color:#cfcabd;font-size:14px;margin:0 0 4px">${esc(nextEvent.whenLabel)}${nextEvent.venue ? ' &middot; ' + esc(nextEvent.venue) : ''}</p>
        <p style="color:#a8a296;font-size:13.5px;line-height:1.55;margin:10px 0 16px">
          Our events fill up fast and members hear first. Grab your ticket now rather than hearing about it in the group afterwards.
        </p>
        <a href="${site}/events/${nextEvent.slug}" style="display:inline-block;background:#C8861A;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:11px">Get your tickets</a>
        <p style="margin:14px 0 0"><a href="${site}/events" style="color:#C8861A;font-size:13px;text-decoration:none">See everything coming up &rarr;</a></p>
      </div>
    </div>`
    : ''

  // No business count on purpose: a number invites "only that many?", where the
  // trades below imply breadth without ever being counted.
  const directoryBlock = `
    <div style="padding:26px 28px 0">
      <div style="background:#1a1a1a;border:1px solid #3a3222;border-radius:14px;padding:22px">
        <p style="color:#C8861A;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:bold;margin:0 0 8px">The BILD Business Directory</p>
        <p style="color:#F4F1EC;font-family:Georgia,serif;font-size:20px;margin:0 0 10px">Our community's go-to list</p>
        <p style="color:#a8a296;font-size:13.5px;line-height:1.6;margin:0 0 14px">
          Before you ask the group for a recommendation, look here first. Every business is run by someone in this
          community, and every listing is checked by a BILD admin before it goes live.
        </p>
        <p style="color:#a8a296;font-size:13.5px;line-height:1.6;margin:0 0 18px">
          Lawyers, accountants, caterers, jewellers, makeup artists, tutors, trades. People you can call knowing a
          neighbour already trusts them, and many offer a members-only discount.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding-right:6px">
              <a href="${site}/directory" style="display:block;background:#C8861A;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:13px 10px;border-radius:11px;text-align:center">Browse the directory</a>
            </td>
            <td width="50%" style="padding-left:6px">
              <a href="${site}/directory/submit" style="display:block;border:1.5px solid #C8861A;color:#C8861A;text-decoration:none;font-weight:bold;font-size:14px;padding:11.5px 10px;border-radius:11px;text-align:center">List your business</a>
            </td>
          </tr>
        </table>
        <p style="color:#6f6a60;font-size:12px;line-height:1.5;margin:14px 0 0">
          Run your own business? Get it in front of the whole community, where people are already looking for
          someone they can trust.
        </p>
      </div>
    </div>`

  // The grey line the inbox shows beside the subject. Without one, clients take
  // whatever text comes first, which here would be "WELCOME TO BILD".
  const preheader = manualAdd
    ? 'We are adding you to the WhatsApp community, plus what is coming up next.'
    : 'Five quick steps to join the WhatsApp community, plus what is coming up next.'

  const html = `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#0E0E0E;border-radius:16px;overflow:hidden">
    <div style="padding:32px 28px 8px;text-align:center">
      <div style="color:#C8861A;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:bold">Welcome to BILD</div>
      <h1 style="color:#F4F1EC;font-family:Georgia,serif;font-size:28px;margin:12px 0 8px">You're in, ${first}! 🎉</h1>
      <p style="color:#cfcabd;font-size:15px;line-height:1.6;margin:0 0 10px">${feeLine} You've joined 2,000+ British Indians across the UAE.</p>
      ${receiptLine}
      ${googleBadge}
    </div>
    <div style="padding:8px 28px 0">${whatsappBlock}</div>
    ${eventBlock}
    ${directoryBlock}
    <div style="padding:26px 28px 8px">
      <p style="color:#6f6a60;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px;text-align:center">Also worth a look</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:9px 0;border-bottom:1px solid #2a2a2a;color:#a8a296;font-size:13.5px">📸&nbsp; <a href="${site}/photo-vault" style="color:#C8861A;text-decoration:none;font-weight:bold">Photo Vault</a> &ndash; every event, every year</td></tr>
        <tr><td style="padding:9px 0;color:#a8a296;font-size:13.5px">🎬&nbsp; <a href="${site}/faces-of-bild" style="color:#C8861A;text-decoration:none;font-weight:bold">Faces of BILD</a> &ndash; the people behind the community</td></tr>
      </table>
    </div>
    <div style="padding:18px 28px 26px;text-align:center">
      <p style="color:#6f6a60;font-size:12px;margin:0">Questions? Just reply, or email <a href="mailto:connect@bild.ae" style="color:#C8861A;text-decoration:none">connect@bild.ae</a></p>
    </div>
    <div style="background:#1a1a1a;padding:16px;text-align:center;color:#6b6b6b;font-size:11px">
      BILD &middot; British Indians Living in Dubai &middot; Established 2019
    </div>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: opts.to,
      // Names what the email is for. The old subject promised an "invite",
      // which is part of why a used-up link felt like a broken promise.
      subject: manualAdd
        ? `You're in, ${opts.name?.split(' ')[0] || 'welcome'} - welcome to BILD`
        : `You're in, ${opts.name?.split(' ')[0] || 'welcome'} - here's how to join the BILD group`,
      html,
    })
    // Resend reports a bad address in the result rather than throwing, so
    // checking only the catch block misses exactly the case that matters.
    if (result.error) {
      console.error('Welcome email rejected by Resend:', result.error)
      await alertEmailFailure(opts.to, 'Welcome email', result.error.message || String(result.error))
    }
  } catch (e) {
    // Don't let email failure break the webhook
    console.error('Welcome email failed:', e)
    await alertEmailFailure(opts.to, 'Welcome email', e instanceof Error ? e.message : String(e))
  }
}

export async function sendAbandonedJoinReminder(opts: { to: string; name?: string; gender?: string | null }) {
  const first = esc(opts.name?.split(' ')[0] || 'there')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'
  const isFemale = (opts.gender || '').toLowerCase() === 'female'
  const continueLink = `<a href="${siteUrl}/join" style="color:#C8861A">go back and finish it</a>`

  const bodyHtml = isFemale
    ? `
      <p style="margin:0 0 16px">Hi ${first} 💕 It's Truna from BILD.</p>
      <p style="margin:0 0 16px">I noticed you started your BILD membership application but didn't quite get to the end, so I just wanted to personally check in and see if you had any problems completing the form, or if there was anything that wasn't clear?</p>
      <p style="margin:0 0 16px">For anyone new to BILD, we're a really friendly and supportive community of British Indians living in Dubai. We know that moving away from home and building a new circle isn't always easy, whether you've just arrived or have been here for years, and that's really at the heart of what BILD is about. ❤️</p>
      <p style="margin:0 0 16px">As a member, there are lots of ways to get involved, from our WhatsApp community and meeting like minded people, to our events and activities throughout the year. We also have our BILD Business Directory for anyone who runs a business.</p>
      <p style="margin:0 0 16px">If you did come across anything that made the application difficult or unclear, I'd really appreciate you letting me know. We're always looking at ways to improve the process and your feedback genuinely helps. And if you simply didn't get around to completing it, you're very welcome to ${continueLink} whenever you're ready. 😊</p>
      <p style="margin:0">Hope to see you in BILD soon!<br>Truna 💕</p>`
    : `
      <p style="margin:0 0 16px">Hi ${first} 😊 It's Truna from BILD.</p>
      <p style="margin:0 0 16px">I noticed you started your BILD membership application but didn't quite get to the end, so I just wanted to personally check in and see if you had any problems completing the form, or if there was anything that wasn't clear?</p>
      <p style="margin:0 0 16px">For anyone new to BILD, we're a really friendly and supportive community of British Indians living in Dubai. We know that moving away from home and building a new circle isn't always easy, whether you've just arrived or have been here for years, and that's really at the heart of what BILD is about.</p>
      <p style="margin:0 0 16px">As a member, there are lots of ways to get involved, from our WhatsApp community and meeting like minded people, to our events and activities throughout the year. We also have our BILD Business Directory for anyone who runs a business.</p>
      <p style="margin:0 0 16px">If you did come across anything that made the application difficult or unclear, I'd really appreciate you letting me know. We're always looking at ways to improve the process and your feedback genuinely helps. And if you simply didn't get around to completing it, you're very welcome to ${continueLink} whenever you're ready. 😊</p>
      <p style="margin:0">Hope to see you in BILD soon!<br>Truna</p>`

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#2b2b2b;font-size:15px;line-height:1.7">${bodyHtml}</div>`
  await sendResendEmail(opts.to, `We'd love to welcome you to BILD 💛`, html, 'Abandoned join reminder')
}

// Admin alert whenever a new member joins (fires once payment is confirmed).
export async function sendNewMemberAlert(opts: {
  name: string
  gender?: string
  whatsappNumber?: string
  uaeMobile?: string
  ukCity?: string
  indiaCity?: string
  religion?: string
  referrerName?: string
  referrerMobile?: string
}) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  const sex = opts.gender === 'female' ? 'Female' : opts.gender === 'male' ? 'Male' : 'Not given'
  const val = (v?: string) => (v && v.trim() ? esc(v) : 'Not given')
  const row = (label: string, value: string) => `
        <tr>
          <td style="padding:7px 0;color:#8a857a;font-size:12px;text-transform:uppercase;letter-spacing:1px;vertical-align:top;width:150px">${label}</td>
          <td style="padding:7px 0;color:#0E0E0E;font-size:15px;font-weight:bold">${value}</td>
        </tr>`

  const femaleNote = ''

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 4px">🎉 New BILD member</h2>
    <p style="color:#555;font-size:13px;margin:0 0 16px">A new member has joined and paid.</p>
    <div style="border:1px solid #eee;border-radius:10px;padding:6px 16px">
      <table style="width:100%;border-collapse:collapse">
        ${row('Name', val(opts.name))}
        ${row('Sex', sex)}
        ${row('WhatsApp', val(opts.whatsappNumber))}
        ${row('UAE mobile', val(opts.uaeMobile))}
        ${row('From (UK)', val(opts.ukCity))}
        ${row('Family from (India)', val(opts.indiaCity))}
        ${row('Religion', val(opts.religion))}
        ${row('Estimated Ai Ethnicity Search', esc(originEstimateText(opts.name)))}
        ${row('Recommended by', val(opts.referrerName))}
        ${row('Their phone', val(opts.referrerMobile))}
      </table>
    </div>
    ${femaleNote}
    <p style="color:#999;font-size:12px;margin-top:14px;line-height:1.5">
      The ethnicity estimate is a rough guess from the name only. It is often wrong for Anglicised,
      married or mixed-heritage names, so always rely on the member&rsquo;s own declared answers above.
    </p>
    <p style="color:#999;font-size:12px;margin-top:10px">Full details are in the admin members list and the weekly Excel backup.</p>
  </div>`

  try {
    await resend.emails.send({
      from: FROM,
      to: ADMIN_ALERT_EMAILS,
      subject: `New BILD member: ${opts.name}`,
      html,
    })
  } catch (e) {
    console.error('New member alert failed:', e)
  }
}

export async function sendEventConfirmation(opts: {
  to: string
  firstName?: string
  // Used so the buyer appears in the attendee list by full name, like everyone
  // else on the booking.
  lastName?: string | null
  eventTitle: string
  ticketName?: string | null
  eventDate: string
  amountAed: number
  totalPaidAed?: number
  receiptUrl?: string
  quantity?: number
  guests?: GuestEntry[]
  // The buyer's own age, set only when they are themselves on a child ticket.
  attendeeAge?: number | null
  venue?: string | null
  googleMapsUrl?: string | null
  // Used to build the "add to calendar" links. Omitted for older callers, in
  // which case the calendar row is simply left out.
  eventSlug?: string | null
  eventEndDate?: string | null
}) {
  if (!apiKey) {
    console.warn('Email skipped: RESEND_API_KEY not set')
    return { ok: false, reason: 'Email is not configured on this server (RESEND_API_KEY is not set).' }
  }
  const resend = new Resend(apiKey)
  const first = esc(opts.firstName || 'there')
  const qty = opts.quantity && opts.quantity > 0 ? opts.quantity : 1
  const guests = (opts.guests || []).filter(g => g && g.name)
  const when = new Date(opts.eventDate).toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Dubai', // events are always Dubai-local, regardless of server timezone
  })
  // When we know the true Stripe-charged total (subtotal + card fee), show a
  // full breakdown so the fee isn't hidden - otherwise fall back to one line.
  const paymentBlock =
    opts.amountAed > 0 && opts.totalPaidAed != null
      ? `<p style="color:#cfcabd;font-size:14px;margin:0">Tickets: ${opts.amountAed} AED</p>
         <p style="color:#cfcabd;font-size:14px;margin:4px 0 0">Third Party Card processing Fee: ${(opts.totalPaidAed - opts.amountAed).toFixed(2)} AED</p>
         <p style="color:#C8861A;font-size:15px;font-weight:bold;margin:8px 0 0">Total paid: ${opts.totalPaidAed} AED</p>`
      : opts.amountAed > 0
        ? `<p style="color:#C8861A;font-size:15px;font-weight:bold;margin:0">${opts.amountAed} AED paid</p>`
        : `<p style="color:#C8861A;font-size:15px;font-weight:bold;margin:0">Free registration</p>`
  const receiptLine = opts.receiptUrl
    ? `<p style="margin:16px 0 0"><a href="${opts.receiptUrl}" style="color:#C8861A;font-size:13px;text-decoration:underline">View your Stripe receipt &rarr;</a></p>`
    : ''

  // "Add to calendar" links, anchored to Dubai time like the event page.
  const calendarBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'
  const calendarBlock = opts.eventSlug
    ? `
        <p style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:18px 0 6px">Add to your calendar</p>
        <p style="margin:0">
          <a href="${googleCalendarUrl({
            title: opts.eventTitle,
            startIso: opts.eventDate,
            endIso: opts.eventEndDate,
            venue: opts.venue,
            url: `${calendarBase}/events/${opts.eventSlug}`,
          })}" style="color:#C8861A;font-size:14px;text-decoration:underline">Google Calendar</a>
          <span style="color:#4a4a4a">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
          <a href="${calendarBase}/events/${opts.eventSlug}/calendar.ics" style="color:#C8861A;font-size:14px;text-decoration:underline">Apple / Outlook</a>
        </p>`
    : ''
  // Everyone the booking covers, in one list with a total above it.
  //
  // This used to print "Ticket: Adult Ticket (you)" in the main position, with
  // the rest of the party under a small grey "Guests" label and no count
  // anywhere. A member who had paid for two adults, a child and an infant read
  // the first line as her whole order and thought only one ticket had come
  // through. The count now leads, and the buyer is listed with everyone else.
  const attendees = [
    { name: `${opts.firstName || ''} ${opts.lastName || ''}`.trim(), ticket: opts.ticketName || '', isBuyer: true, age: opts.attendeeAge ?? null },
    ...guests.map(g => ({ name: g.name, ticket: g.ticket_name || '', isBuyer: false, age: g.age ?? null })),
  ].filter(a => a.name)

  const counts = new Map<string, number>()
  for (const a of attendees) if (a.ticket) counts.set(a.ticket, (counts.get(a.ticket) || 0) + 1)
  const breakdown = Array.from(counts.entries()).map(([name, n]) => `${n} x ${esc(name)}`).join(', ')
  const totalTickets = Math.max(qty, attendees.length)

  const label = (text: string) =>
    `<p style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">${text}</p>`
  const ticketsBlock =
    `${label('Tickets')}<p style="color:#F4F1EC;font-size:17px;font-weight:bold;margin:0 0 4px">${totalTickets} ticket${totalTickets === 1 ? '' : 's'}</p>` +
    // The breakdown is only worth printing when there is more than one ticket:
    // "1 ticket" followed by "1 x Adult Ticket" just says it twice.
    (breakdown && totalTickets > 1 ? `<p style="color:#cfcabd;font-size:14px;margin:0 0 16px">${breakdown}</p>` : '<div style="margin:0 0 16px"></div>')
  const attendeesBlock = attendees.length
    ? `${label("Who's coming")}<p style="color:#cfcabd;font-size:15px;margin:0 0 16px">${attendees
        .map(a => `${esc(a.name)}${a.isBuyer ? ' (you)' : ''}${a.ticket ? ` &mdash; ${esc(a.ticket)}` : ''}${a.age != null ? ` (age ${a.age})` : ''}`)
        .join('<br>')}</p>`
    : ''

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#0E0E0E;border-radius:16px;overflow:hidden">
    <div style="padding:32px 28px">
      <div style="color:#C8861A;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;text-align:center">You're registered</div>
      <h1 style="color:#F4F1EC;font-family:Georgia,serif;font-size:26px;margin:12px 0 20px;text-align:center">See you there, ${first}! 🎉</h1>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px 22px;margin-bottom:20px">
        <p style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Event</p>
        <p style="color:#F4F1EC;font-size:17px;font-weight:bold;margin:0 0 16px">${esc(opts.eventTitle)}</p>
        <p style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Date &amp; time</p>
        <p style="color:#cfcabd;font-size:15px;margin:0 0 16px">${when}</p>
        ${opts.venue || opts.googleMapsUrl ? `
        <p style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Venue</p>
        <p style="color:#cfcabd;font-size:15px;margin:0 0 16px">
          ${opts.venue ? esc(opts.venue) : ''}${opts.venue && opts.googleMapsUrl ? '<br>' : ''}${opts.googleMapsUrl ? `<a href="${opts.googleMapsUrl}" style="color:#C8861A">View on Google Maps &rarr;</a>` : ''}
        </p>` : ''}
        ${ticketsBlock}
        ${attendeesBlock}
        <p style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px">Payment</p>
        ${paymentBlock}
        ${receiptLine}
        ${calendarBlock}
      </div>
      <p style="color:#8a857a;font-size:12px;text-align:center;margin:0">
        Please keep this email, you may be asked for your name at the door. Questions? Reply or email events@bild.ae
      </p>
    </div>
    <div style="background:#1a1a1a;padding:16px;text-align:center;color:#6b6b6b;font-size:11px">
      BILD · British Indians Living in Dubai · Established 2019
    </div>
  </div>`

  try {
    const result = await resend.emails.send({
      from: EVENTS_FROM,
      to: opts.to,
      subject: `You're registered: ${opts.eventTitle}`,
      html,
    })
    if (result.error) {
      const reason = result.error.message || String(result.error)
      console.error('Event confirmation rejected by Resend:', result.error)
      await alertEmailFailure(opts.to, `Ticket confirmation for ${opts.eventTitle}`, reason)
      return { ok: false, reason }
    }
    return { ok: true }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.error('Event confirmation email failed:', e)
    await alertEmailFailure(opts.to, `Ticket confirmation for ${opts.eventTitle}`, reason)
    return { ok: false, reason }
  }
}

// Refund confirmation, sent to the customer with the admin team copied in.
//
// Sent from the shared refund helper rather than from a route, so a refund
// issued by the Refund button and one issued automatically by a ticket
// downgrade both produce the same email, and neither can be forgotten.
export async function sendRefundConfirmation(opts: {
  to: string
  firstName?: string
  eventTitle: string
  ticketName?: string | null
  refundedAed: number
  adminFeeAed?: number
  totalRefundedAed: number
  // What Stripe says the card was actually charged, card fee included. Taken
  // from Stripe rather than worked out from the booking, because a ticket
  // change rewrites the booking's value and a second refund would otherwise
  // be measured against an amount that was never paid. Absent on a booking
  // with no card payment behind it, and then simply not shown.
  originallyChargedAed?: number
  // Money already given back on this booking before today, so a second
  // refund adds up on the page instead of appearing to contradict the first.
  previouslyRefundedAed?: number
  stillAttending: boolean
  reason?: string
}): Promise<{ ok: boolean; reason?: string }> {
  if (!apiKey) {
    console.warn('Email skipped: RESEND_API_KEY not set')
    return { ok: false, reason: 'Email is not configured on this server (RESEND_API_KEY is not set).' }
  }
  const resend = new Resend(apiKey)
  const first = esc(opts.firstName?.split(' ')[0] || 'there')
  const money = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const fee = opts.adminFeeAed && opts.adminFeeAed > 0 ? opts.adminFeeAed : 0
  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:7px 0;color:#9a9384;font-size:14px">${label}</td>
      <td style="padding:7px 0;text-align:right;color:${strong ? '#C8861A' : '#F4F1EC'};font-size:${strong ? '17px' : '14px'};font-weight:${strong ? 'bold' : 'normal'}">${value}</td>
    </tr>`

  const html = bizEmailShell({
    kicker: 'BILD Events',
    contact: 'events@bild.ae',
    heading: 'Your refund is on its way',
    bodyHtml: `
      <p>Hi ${first},</p>
      <p>We have refunded you for <strong>${esc(opts.eventTitle)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0;border-top:1px solid #2a2a2a;border-bottom:1px solid #2a2a2a">
        ${opts.ticketName ? row('Ticket', esc(opts.ticketName)) : ''}
        ${opts.originallyChargedAed != null ? row('Charged to your card', `${money(opts.originallyChargedAed)} AED`) : ''}
        ${opts.previouslyRefundedAed && opts.previouslyRefundedAed > 0 ? row('Already refunded before today', `${money(opts.previouslyRefundedAed)} AED`) : ''}
        ${fee > 0 ? row('Administration fee retained', `${money(fee)} AED`) : ''}
        ${row('Refunded to your card', `${money(opts.refundedAed)} AED`, true)}
      </table>
      <p style="color:#9a9384;font-size:14px">
        The money goes back to the card you paid with. Your bank usually takes 5 to 10 working days to show it,
        and that timing is set by them rather than by us.
      </p>
      ${opts.stillAttending
        ? `<p><strong style="color:#F4F1EC">You are still booked in for this event.</strong> Your place is unchanged and we look forward to seeing you.</p>`
        : `<p>Your booking has been cancelled and your place released. We hope to see you at the next one.</p>`}
      ${opts.reason ? `<p style="color:#9a9384;font-size:13px">Reference: ${esc(opts.reason)}</p>` : ''}
      <p style="margin-top:18px">If anything here looks wrong, just reply to this email and we will sort it out.</p>
    `,
  })

  try {
    const result = await resend.emails.send({
      from: EVENTS_FROM,
      to: opts.to,
      // Blind copy, not Cc. The internal recipients include personal
      // addresses, and a Cc header is visible to the customer: every ticket
      // buyer receiving a refund would otherwise be shown them. The copy still
      // arrives; replies go to the events inbox via the From address.
      bcc: EVENTS_ALERT_EMAILS,
      subject: `Refund confirmation: ${opts.eventTitle}`,
      html,
    })
    if (result.error) {
      const reason = result.error.message || String(result.error)
      console.error('Refund confirmation rejected by Resend:', result.error)
      await alertEmailFailure(opts.to, `Refund confirmation for ${opts.eventTitle}`, reason)
      return { ok: false, reason }
    }
    return { ok: true }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.error('Refund confirmation email failed:', e)
    await alertEmailFailure(opts.to, `Refund confirmation for ${opts.eventTitle}`, reason)
    return { ok: false, reason }
  }
}

// Weekly link check found a listing pointing at a dead website.
export async function sendBrokenLinkAdminAlert(opts: {
  businesses: { name: string; url: string; reason: string }[]
  recovered?: string[]
}) {
  const rows = opts.businesses.map(b => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a">
        <strong style="color:#F4F1EC">${esc(b.name)}</strong><br>
        <a href="${esc(b.url)}" style="color:#C8861A;font-size:13px">${esc(b.url)}</a><br>
        <span style="color:#d98a76;font-size:13px">${esc(b.reason)}</span>
      </td>
    </tr>`).join('')

  const count = opts.businesses.length
  const html = adminAlertShell({
    heading: count === 1 ? 'A directory listing has a dead website' : `${count} directory listings have dead websites`,
    bodyHtml: `
      <p>The weekly link check found ${count === 1 ? 'this listing' : 'these listings'} pointing at a website that
      has failed twice in a row. A single bad week is ignored, so this is unlikely to be a blip.</p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0">${rows}</table>
      <p>Nothing has been changed or unpublished. Contact the business for a working address, or remove the website
      link from their listing and leave the rest of the profile in place.</p>
      ${opts.recovered && opts.recovered.length
        ? `<p style="color:#7fbfa8">Back up again this week: ${esc(opts.recovered.join(', '))}.</p>`
        : ''}
    `,
  })

  await sendResendEmail(
    ADMIN_ALERT_EMAILS,
    `BILD: ${count} directory ${count === 1 ? 'website is' : 'websites are'} not working`,
    html,
    'Broken link alert',
  )
}

// Waitlist: told them they are on the list.
export async function sendWaitlistJoinedEmail(opts: {
  to: string; firstName?: string; eventTitle: string; ticketsWanted: number
}) {
  const first = esc(opts.firstName?.split(' ')[0] || 'there')
  const n = opts.ticketsWanted
  const html = bizEmailShell({
    kicker: 'BILD Events',
    contact: 'events@bild.ae',
    heading: 'You are on the waitlist',
    bodyHtml: `
      <p>Hi ${first},</p>
      <p>You are on the waitlist for <strong>${esc(opts.eventTitle)}</strong>, for
      ${n} ticket${n === 1 ? '' : 's'}.</p>
      <p>The event is sold out. If a place frees up, which happens when someone cancels, we will email you with a
      link to book. Places are offered in the order people joined the list.</p>
      <p style="color:#9a9384;font-size:14px">
        Nothing is reserved and nothing has been charged. If your plans change and you no longer need a place, reply
        to this email and we will take you off the list so it goes to someone else.
      </p>
    `,
  })
  await sendResendEmailFrom(EVENTS_FROM, opts.to, `You are on the waitlist: ${opts.eventTitle}`, html, 'Waitlist confirmation')
}

// Waitlist: somebody joined.
export async function sendWaitlistJoinedAdminAlert(opts: {
  eventTitle: string; name: string; email: string; phone?: string
  ticketsWanted: number; totalWaiting: number
}) {
  const html = adminAlertShell({
    heading: 'Someone joined an event waitlist',
    bodyHtml: `
      <p><strong>${esc(opts.eventTitle)}</strong></p>
      <p>${esc(opts.name)} &middot; <a href="mailto:${esc(opts.email)}" style="color:#C8861A">${esc(opts.email)}</a>
      ${opts.phone ? `&middot; ${esc(opts.phone)}` : ''}</p>
      <p>Wants ${opts.ticketsWanted} ticket${opts.ticketsWanted === 1 ? '' : 's'}.</p>
      <p><strong>${opts.totalWaiting}</strong> now waiting for this event. The full list is in Admin, Events, Manage.</p>
    `,
  })
  await sendResendEmailFrom(EVENTS_FROM, EVENTS_ALERT_EMAILS, `Waitlist: ${opts.name} for ${opts.eventTitle}`, html, 'Waitlist admin alert')
}

// Waitlist: a place has come up.
export async function sendWaitlistOfferEmail(opts: {
  to: string; firstName?: string; eventTitle: string; eventUrl: string; ticketsAvailable?: number
}) {
  const first = esc(opts.firstName?.split(' ')[0] || 'there')
  const html = bizEmailShell({
    kicker: 'BILD Events',
    contact: 'events@bild.ae',
    heading: 'A place has come up',
    bodyHtml: `
      <p>Hi ${first},</p>
      <p>A place has become available for <strong>${esc(opts.eventTitle)}</strong>, and you are next on the waitlist.</p>
      ${opts.ticketsAvailable ? `<p>There ${opts.ticketsAvailable === 1 ? 'is 1 ticket' : `are ${opts.ticketsAvailable} tickets`} available right now.</p>` : ''}
      <p><strong>Book as soon as you can.</strong> The place is not held for you: it goes to whoever books first, and
      we may offer it to others on the list as well.</p>
    `,
    ctaUrl: opts.eventUrl,
    ctaLabel: 'Book your place',
  })
  await sendResendEmailFrom(EVENTS_FROM, opts.to, `A place has come up: ${opts.eventTitle}`, html, 'Waitlist offer')
}

// Confirmation email for an admin password change. Returns the masked recipient.
export async function sendPasswordChangeConfirmation(opts: { confirmUrl: string }): Promise<string> {
  const to = ADMIN_ALERT_EMAILS
  const mask = (addr: string) => {
    const [name, domain] = addr.split('@')
    const m = name.length <= 2 ? `${name[0]}***` : `${name[0]}***${name[name.length - 1]}`
    return domain ? `${m}@${domain}` : addr
  }
  const maskedList = to.map(mask).join(', ')
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return maskedList }
  const resend = new Resend(apiKey)

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 8px">Confirm your BILD admin password change</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px">
      We received a request to change the BILD admin password. If this was you, click below to confirm.
      The link expires in 30 minutes. <strong>If you did not request this, ignore this email</strong>. The
      password will not change and no action is needed.
    </p>
    <a href="${opts.confirmUrl}" style="display:inline-block;background:#C8861A;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:10px">
      Confirm password change
    </a>
    <p style="color:#999;font-size:12px;margin-top:18px;word-break:break-all">
      Or paste this link into your browser:<br>${opts.confirmUrl}
    </p>
  </div>`

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Confirm your BILD admin password change',
      html,
    })
  } catch (e) {
    console.error('Password change email failed:', e)
  }
  return maskedList
}

// Sent to all admins once a password change actually completes (the
// confirmation link was clicked and the new password took effect) -
// distinct from sendPasswordChangeConfirmation above, which fires when the
// change is first requested and still needs confirming.
export async function sendPasswordChangedNotification() {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  const when = new Date().toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Dubai',
  })

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 8px">BILD admin password changed</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 12px">
      The BILD admin password was successfully changed on <strong>${esc(when)}</strong> (Dubai time).
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0">
      If this wasn&rsquo;t you or another admin, please contact connect@bild.ae immediately.
    </p>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: ADMIN_ALERT_EMAILS,
      subject: 'BILD admin password was changed',
      html,
    })
    if (result.error) console.error('Password changed notification rejected by Resend:', result.error)
  } catch (e) {
    console.error('Password changed notification failed:', e)
  }
}

// Admin alert whenever a ticket is sold (paid or free registration completes).
export async function sendTicketSaleAlert(opts: {
  eventTitle: string
  buyerName: string
  buyerEmail: string
  ticketName?: string | null
  quantity?: number
  amountAed: number
  guests?: GuestEntry[]
  totalTicketsSold?: number
}) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return } // email disabled until a key is set
  const resend = new Resend(apiKey)
  const qty = opts.quantity && opts.quantity > 0 ? opts.quantity : 1
  const guests = (opts.guests || []).filter(g => g && g.name)
  const guestLines = guests.length
    ? `<p style="margin:2px 0 0;color:#555;font-size:13px">Guests: ${guests.map(g => `${esc(g.name)}${g.ticket_name ? ` (${esc(g.ticket_name)})` : ''}`).join(', ')}</p>`
    : ''
  const money = opts.amountAed > 0 ? `${opts.amountAed} AED` : 'Free'
  const totalLine = opts.totalTicketsSold != null
    ? `<p style="margin:2px 0 0;color:#555;font-size:14px">Total tickets sold for this event: <strong>${opts.totalTicketsSold}</strong></p>`
    : ''

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 4px">🎟️ New ticket sale: ${esc(opts.eventTitle)}</h2>
    <p style="color:#555;font-size:14px;margin:0 0 4px">${qty} ticket${qty === 1 ? '' : 's'} · ${money}</p>
    ${totalLine}
    <div style="border:1px solid #eee;border-radius:10px;padding:16px;margin-top:12px">
      <p style="margin:0;color:#0E0E0E;font-size:15px;font-weight:bold">${esc(opts.buyerName)}</p>
      <p style="margin:2px 0 0;color:#555;font-size:13px">${esc(opts.buyerEmail)}</p>
      <p style="margin:8px 0 0;color:#555;font-size:13px">Their ticket: ${opts.ticketName ? esc(opts.ticketName) : 'n/a'}</p>
      ${guestLines}
    </div>
    <p style="color:#999;font-size:12px;margin-top:14px">View the full door list in the BILD admin → Events.</p>
  </div>`

  try {
    await resend.emails.send({
      from: EVENTS_FROM,
      to: EVENTS_ALERT_EMAILS,
      subject: `New sale: ${opts.eventTitle}, ${qty} ticket${qty === 1 ? '' : 's'} (${money})`,
      html,
    })
  } catch (e) {
    console.error('Ticket sale alert failed:', e)
  }
}

// Admin alert whenever a new business is submitted to the directory.
export async function sendNewBusinessAlert(opts: {
  businessName: string
  category: string
  ownerName: string
  email: string
  phone: string
  location: string
  tagline?: string | null
  country?: string
  isBildMember?: boolean
  membershipUnverified?: boolean
}) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  const row = (label: string, value: string) => `
        <tr>
          <td style="padding:7px 0;color:#8a857a;font-size:12px;text-transform:uppercase;letter-spacing:1px;vertical-align:top;width:150px">${label}</td>
          <td style="padding:7px 0;color:#0E0E0E;font-size:15px;font-weight:bold">${value}</td>
        </tr>`

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 4px">New business directory submission</h2>
    <p style="color:#555;font-size:13px;margin:0 0 16px">A member has submitted a business for review.</p>
    ${opts.isBildMember && opts.membershipUnverified ? `
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 16px;margin:0 0 14px">
      <p style="color:#991b1b;font-size:13px;font-weight:bold;margin:0">⚠ Membership unverified</p>
      <p style="color:#991b1b;font-size:12px;margin:4px 0 0">This business claims BILD membership, but no paid member matches its email or phone.</p>
    </div>` : ''}
    <div style="border:1px solid #eee;border-radius:10px;padding:6px 16px">
      <table style="width:100%;border-collapse:collapse">
        ${row('Business', esc(opts.businessName))}
        ${row('BILD member', opts.isBildMember ? (opts.membershipUnverified ? 'Yes (unverified)' : 'Yes (verified)') : 'No')}
        ${opts.country ? row('Registered in', esc(opts.country)) : ''}
        ${row('Category', esc(opts.category))}
        ${opts.tagline ? row('Tagline', esc(opts.tagline)) : ''}
        ${row('Owner', esc(opts.ownerName))}
        ${row('Email', esc(opts.email))}
        ${row('Phone', esc(opts.phone))}
        ${row('Location', esc(opts.location))}
      </table>
    </div>
    <p style="color:#999;font-size:12px;margin-top:14px">Review, approve or reject it in the BILD admin → Directory.</p>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: ADMIN_ALERT_EMAILS,
      subject: `New business submission: ${opts.businessName}`,
      html,
    })
    if (result.error) {
      console.error('New business alert rejected by Resend:', result.error)
    } else {
      console.log(`New business alert sent to ${ADMIN_ALERT_EMAILS.join(', ')}, id: ${result.data?.id}`)
    }
  } catch (e) {
    console.error('New business alert failed:', e)
  }
}

// Sent to a business owner when their directory submission is rejected.
export async function sendBusinessRejection(opts: {
  to: string
  businessName: string
  ownerName?: string
  reason: string
}) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  const first = esc(opts.ownerName?.split(' ')[0] || 'there')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#0E0E0E;border-radius:16px;overflow:hidden">
    <div style="padding:32px 28px">
      <div style="color:#C8861A;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;text-align:center">BILD Business Directory</div>
      <h1 style="color:#F4F1EC;font-family:Georgia,serif;font-size:24px;margin:12px 0 16px;text-align:center">Update on your listing</h1>
      <p style="color:#cfcabd;font-size:15px;line-height:1.6;margin:0 0 16px">
        Hi ${first}, thanks for submitting <strong>${esc(opts.businessName)}</strong> to the BILD Business Directory.
        After review, we&rsquo;re not able to list it at this time.
      </p>
      <div style="background:#1a1a1a;border-radius:12px;padding:18px 20px;margin:0 0 20px">
        <p style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px">Reason</p>
        <p style="color:#F4F1EC;font-size:15px;line-height:1.6;margin:0">${esc(opts.reason)}</p>
      </div>
      <p style="color:#cfcabd;font-size:14px;line-height:1.6;margin:0">
        If you believe this was a mistake, or once you&rsquo;re able to address the above, you&rsquo;re welcome to submit again at any time.
      </p>
      <p style="color:#8a857a;font-size:12px;margin-top:18px">Questions? Reply or email connect@bild.ae</p>
    </div>
    <div style="background:#1a1a1a;padding:16px;text-align:center;color:#6b6b6b;font-size:11px">
      BILD · British Indians Living in Dubai · Established 2019
    </div>
  </div>`

  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Your BILD directory submission: ${opts.businessName}`,
      html,
    })
  } catch (e) {
    console.error('Business rejection email failed:', e)
  }
}

// Sent to a business owner when their directory submission is approved -
// includes their own shareable directory page link.
export async function sendBusinessApprovedEmail(opts: {
  to: string
  businessName: string
  ownerName?: string
  profileUrl: string
  featuredUrl?: string
  freeUntil?: string | null
  // Only for a business not already showing Google reviews.
  googleReviewsUrl?: string | null
}) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  const first = esc(opts.ownerName?.split(' ')[0] || 'there')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#0E0E0E;border-radius:16px;overflow:hidden">
    <div style="padding:32px 28px">
      <div style="color:#C8861A;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;text-align:center">BILD Business Directory</div>
      <h1 style="color:#F4F1EC;font-family:Georgia,serif;font-size:26px;margin:12px 0 16px;text-align:center">You&rsquo;re live! 🎉</h1>
      <p style="color:#cfcabd;font-size:15px;line-height:1.6;margin:0 0 20px">
        Hi ${first}, great news - <strong>${esc(opts.businessName)}</strong> is now live in the BILD Business Directory.
      </p>
      <div style="background:#1a1a1a;border-radius:12px;padding:18px 20px;margin:0 0 20px">
        <p style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px">Your page</p>
        <a href="${opts.profileUrl}" style="color:#C8861A;font-size:15px;word-break:break-all">${opts.profileUrl}</a>
      </div>
      <p style="color:#cfcabd;font-size:14px;line-height:1.6;margin:0">
        This is your own shareable link - feel free to send it to clients, add it to your own website, or share it
        on social media.
      </p>
      ${opts.freeUntil ? `
      <p style="color:#cfcabd;font-size:14px;line-height:1.6;margin:16px 0 0">
        Your listing is free until <strong>${esc(opts.freeUntil)}</strong> - no payment needed until then.
      </p>` : ''}
      ${opts.googleReviewsUrl ? `
      <div style="background:#1a1a1a;border-radius:12px;padding:18px 20px;margin:20px 0 0">
        <p style="color:#F4F1EC;font-size:14px;line-height:1.6;margin:0 0 10px">
          Have Google reviews? Show your star rating and reviews on your listing. Copy the <strong>Ask for reviews</strong>
          link from your Google Business Profile, then paste it in here.
        </p>
        <a href="${opts.googleReviewsUrl}" style="color:#C8861A;font-size:14px;font-weight:bold">Add your Google reviews &rarr;</a>
      </div>` : ''}
      ${opts.featuredUrl ? `
      <div style="background:#1a1a1a;border-radius:12px;padding:18px 20px;margin:20px 0 0">
        <p style="color:#F4F1EC;font-size:14px;line-height:1.6;margin:0 0 10px">
          Want more visibility? Get <strong>Featured</strong> - gold-highlighted placement, a richer profile page, and more.
        </p>
        <a href="${opts.featuredUrl}" style="color:#C8861A;font-size:14px;font-weight:bold">Learn more &amp; get Featured &rarr;</a>
      </div>` : ''}
      <p style="color:#8a857a;font-size:12px;margin-top:18px">Questions? Reply or email connect@bild.ae</p>
    </div>
    <div style="background:#1a1a1a;padding:16px;text-align:center;color:#6b6b6b;font-size:11px">
      BILD · British Indians Living in Dubai · Established 2019
    </div>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `You're live in the BILD Business Directory!`,
      html,
    })
    if (result.error) {
      console.error('Business approved email rejected by Resend:', result.error)
    }
  } catch (e) {
    console.error('Business approved email failed:', e)
  }
}

// Country-aware document terminology, since UAE and UK businesses upload
// different kinds of registration document.
function docTerm(country?: string, capitalized = false): string {
  const term = country === 'UK' ? 'registration document' : 'trade license'
  return capitalized ? term.charAt(0).toUpperCase() + term.slice(1) : term
}
function docCountryLabel(country?: string): string {
  return country === 'UK' ? 'UK' : 'UAE'
}

// Sent to the business 3 days before their document expiry date.
export async function sendLicenseExpiryReminder(opts: {
  to: string
  businessName: string
  expiryDate: string
  renewalUrl: string
  country?: string
}) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  const term = docTerm(opts.country)

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#0E0E0E;border-radius:16px;overflow:hidden">
    <div style="padding:32px 28px">
      <div style="color:#C8861A;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;text-align:center">BILD Business Directory</div>
      <h1 style="color:#F4F1EC;font-family:Georgia,serif;font-size:24px;margin:12px 0 16px;text-align:center">Your ${term} is expiring soon</h1>
      <p style="color:#cfcabd;font-size:15px;line-height:1.6;margin:0 0 16px">
        The ${docCountryLabel(opts.country)} ${term} on file for <strong>${esc(opts.businessName)}</strong> expires on
        <strong>${esc(opts.expiryDate)}</strong>.
      </p>
      <div style="background:#3a1a1a;border:1px solid #5a2a2a;border-radius:12px;padding:18px 20px;margin:0 0 20px">
        <p style="color:#F4F1EC;font-size:15px;line-height:1.6;margin:0">
          If a renewed document isn&rsquo;t uploaded before this date, your listing will be automatically removed
          from the BILD Business Directory.
        </p>
      </div>
      <a href="${opts.renewalUrl}" style="display:inline-block;background:#C8861A;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:10px">
        Upload renewed document
      </a>
      <p style="color:#8a857a;font-size:12px;margin-top:18px">Questions? Reply or email connect@bild.ae</p>
    </div>
    <div style="background:#1a1a1a;padding:16px;text-align:center;color:#6b6b6b;font-size:11px">
      BILD · British Indians Living in Dubai · Established 2019
    </div>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Action needed: your BILD ${term} expires ${opts.expiryDate}`,
      html,
    })
    if (result.error) {
      console.error('Document expiry reminder rejected by Resend:', result.error)
    }
  } catch (e) {
    console.error('Document expiry reminder failed:', e)
  }
}

// Admin alert sent alongside the business reminder above, informational only.
export async function sendLicenseExpiryAdminAlert(opts: { businessName: string; expiryDate: string; country?: string }) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  const term = docTerm(opts.country)

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 4px">${docCountryLabel(opts.country)} ${term} expiring soon: ${esc(opts.businessName)}</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 12px">
      Their ${term} expires on <strong>${esc(opts.expiryDate)}</strong>. A reminder with a renewal link has
      just been sent to the business. If they don&rsquo;t renew before the expiry date, their listing will be
      automatically removed.
    </p>
    <p style="color:#999;font-size:12px;margin-top:14px">See BILD admin → Directory → Documents for details.</p>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: ADMIN_ALERT_EMAILS,
      subject: `${docCountryLabel(opts.country)} ${term} expiring soon: ${opts.businessName}`,
      html,
    })
    if (result.error) {
      console.error('Document expiry admin alert rejected by Resend:', result.error)
    }
  } catch (e) {
    console.error('Document expiry admin alert failed:', e)
  }
}

// Admin alert sent when a business's document expired and the listing was auto-removed.
export async function sendLicenseDelistedAdminAlert(opts: { businessName: string; expiryDate: string; country?: string }) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  const term = docTerm(opts.country)

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 4px">Listing removed: ${esc(opts.businessName)}</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 12px">
      Their ${docCountryLabel(opts.country)} ${term} expired on <strong>${esc(opts.expiryDate)}</strong> without a renewal being uploaded,
      so their directory listing has been automatically removed.
    </p>
    <p style="color:#999;font-size:12px;margin-top:14px">
      You can re-list them once they submit a renewed document, or manually via BILD admin → Directory → Documents.
    </p>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: ADMIN_ALERT_EMAILS,
      subject: `Listing removed (document expired): ${opts.businessName}`,
      html,
    })
    if (result.error) {
      console.error('Document delisted admin alert rejected by Resend:', result.error)
    }
  } catch (e) {
    console.error('Document delisted admin alert failed:', e)
  }
}

// Sent to the business itself when their listing is auto-removed for an
// expired document - includes a working link so they can still self-serve
// renew and get relisted.
export async function sendLicenseDelistedBusinessEmail(opts: {
  to: string
  businessName: string
  expiryDate: string
  renewalUrl: string
  country?: string
}) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  const term = docTerm(opts.country)

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#0E0E0E;border-radius:16px;overflow:hidden">
    <div style="padding:32px 28px">
      <div style="color:#C8861A;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;text-align:center">BILD Business Directory</div>
      <h1 style="color:#F4F1EC;font-family:Georgia,serif;font-size:24px;margin:12px 0 16px;text-align:center">Your listing has been removed</h1>
      <p style="color:#cfcabd;font-size:15px;line-height:1.6;margin:0 0 16px">
        The ${docCountryLabel(opts.country)} ${term} on file for <strong>${esc(opts.businessName)}</strong> expired on
        <strong>${esc(opts.expiryDate)}</strong> without a renewal being uploaded, so your listing has been
        automatically removed from the BILD Business Directory.
      </p>
      <p style="color:#cfcabd;font-size:15px;line-height:1.6;margin:0 0 20px">
        You can get relisted at any time by uploading a renewed document - an admin will review it before your
        listing goes back live.
      </p>
      <a href="${opts.renewalUrl}" style="display:inline-block;background:#C8861A;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:10px">
        Upload renewed document
      </a>
      <p style="color:#8a857a;font-size:12px;margin-top:18px">Questions? Reply or email connect@bild.ae</p>
    </div>
    <div style="background:#1a1a1a;padding:16px;text-align:center;color:#6b6b6b;font-size:11px">
      BILD · British Indians Living in Dubai · Established 2019
    </div>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Your BILD directory listing has been removed`,
      html,
    })
    if (result.error) {
      console.error('Document delisted business email rejected by Resend:', result.error)
    }
  } catch (e) {
    console.error('Document delisted business email failed:', e)
  }
}

// Admin alert sent when a business submits a renewed document, awaiting approve/decline.
export async function sendRenewalSubmittedAdminAlert(opts: { businessName: string; newExpiryDate: string; country?: string }) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 4px">Document renewal submitted: ${esc(opts.businessName)}</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 12px">
      They&rsquo;ve uploaded a renewed ${docTerm(opts.country)} with a new expiry date of <strong>${esc(opts.newExpiryDate)}</strong>.
      Review and approve or decline it in the BILD admin panel.
    </p>
    <p style="color:#999;font-size:12px;margin-top:14px">See BILD admin → Directory → Documents → Pending renewal approval.</p>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: ADMIN_ALERT_EMAILS,
      subject: `Document renewal submitted: ${opts.businessName}`,
      html,
    })
    if (result.error) {
      console.error('Renewal submitted admin alert rejected by Resend:', result.error)
    }
  } catch (e) {
    console.error('Renewal submitted admin alert failed:', e)
  }
}

// Sent to the business when their renewal is approved by an admin.
export async function sendRenewalApprovedEmail(opts: { to: string; businessName: string; newExpiryDate: string; country?: string }) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#0E0E0E;border-radius:16px;overflow:hidden">
    <div style="padding:32px 28px">
      <div style="color:#C8861A;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;text-align:center">BILD Business Directory</div>
      <h1 style="color:#F4F1EC;font-family:Georgia,serif;font-size:24px;margin:12px 0 16px;text-align:center">Document renewal approved</h1>
      <p style="color:#cfcabd;font-size:15px;line-height:1.6;margin:0 0 16px">
        Your renewed ${docTerm(opts.country)} for <strong>${esc(opts.businessName)}</strong> has been approved. Your listing is
        active with a new expiry date of <strong>${esc(opts.newExpiryDate)}</strong>.
      </p>
      <p style="color:#8a857a;font-size:12px;margin-top:18px">Questions? Reply or email connect@bild.ae</p>
    </div>
    <div style="background:#1a1a1a;padding:16px;text-align:center;color:#6b6b6b;font-size:11px">
      BILD · British Indians Living in Dubai · Established 2019
    </div>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Document renewal approved: ${opts.businessName}`,
      html,
    })
    if (result.error) {
      console.error('Renewal approved email rejected by Resend:', result.error)
    }
  } catch (e) {
    console.error('Renewal approved email failed:', e)
  }
}

// Sent to the business when their renewal is declined by an admin.
export async function sendRenewalDeclinedEmail(opts: { to: string; businessName: string; reason: string; country?: string }) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#0E0E0E;border-radius:16px;overflow:hidden">
    <div style="padding:32px 28px">
      <div style="color:#C8861A;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;text-align:center">BILD Business Directory</div>
      <h1 style="color:#F4F1EC;font-family:Georgia,serif;font-size:24px;margin:12px 0 16px;text-align:center">Document renewal declined</h1>
      <p style="color:#cfcabd;font-size:15px;line-height:1.6;margin:0 0 16px">
        We&rsquo;re unable to accept the renewed ${docTerm(opts.country)} submitted for <strong>${esc(opts.businessName)}</strong>.
      </p>
      <div style="background:#1a1a1a;border-radius:12px;padding:18px 20px;margin:0 0 20px">
        <p style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px">Reason</p>
        <p style="color:#F4F1EC;font-size:15px;line-height:1.6;margin:0">${esc(opts.reason)}</p>
      </div>
      <p style="color:#cfcabd;font-size:14px;line-height:1.6;margin:0">
        Please address the above and reach out to connect@bild.ae so we can send you a fresh upload link.
      </p>
    </div>
    <div style="background:#1a1a1a;padding:16px;text-align:center;color:#6b6b6b;font-size:11px">
      BILD · British Indians Living in Dubai · Established 2019
    </div>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Document renewal update: ${opts.businessName}`,
      html,
    })
    if (result.error) {
      console.error('Renewal declined email rejected by Resend:', result.error)
    }
  } catch (e) {
    console.error('Renewal declined email failed:', e)
  }
}

// Weekly digest of everyone who has started but never completed a BILD
// membership signup (status stays 'pending'), so admins have an ongoing
// follow-up list without needing to check the dashboard themselves.
// The directory equivalent of the weekly join digest.
//
// A partly-filled directory application is a warmer lead than a cold one: they
// looked up the form, typed their business name and their email, and then
// something stopped them. Twenty-two fields is a lot to ask, and the ones who
// stall are usually worth a two-line email rather than writing off.
export async function sendDirectoryLeadsWeeklyReport(opts: {
  rows: {
    businessName: string | null
    ownerName: string | null
    email: string
    phone: string | null
    fieldsFilled: number
    startedAt: string
  }[]
  recoveredThisWeek: { businessName: string | null; email: string }[]
  openTotal: number
}) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  const count = opts.rows.length

  const tableRows = opts.rows.map(r => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#0E0E0E;font-size:13px">${esc(r.businessName || '(not given yet)')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#555;font-size:13px">${esc(r.ownerName || '-')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#555;font-size:13px">${esc(r.email)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#555;font-size:13px">${r.phone ? esc(r.phone) : '-'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#999;font-size:12px;text-align:center">${r.fieldsFilled}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#999;font-size:12px">${new Date(r.startedAt).toLocaleDateString('en-GB')}</td>
        </tr>`).join('')

  const recoveredHtml = opts.recoveredThisWeek.length
    ? `<p style="color:#1d6b3a;font-size:13px;margin:16px 0 0">
         <strong>${opts.recoveredThisWeek.length}</strong> came back and finished this week:
         ${opts.recoveredThisWeek.map(r => esc(r.businessName || r.email)).join(', ')}.
       </p>`
    : ''

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto">
    <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 4px">Directory applications left unfinished</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px">
      <strong>${count}</strong> ${count === 1 ? 'business' : 'businesses'} started listing on the BILD Business
      Directory this week and did not finish. They got far enough to give an email address, so they can be followed up.
    </p>
    ${count ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #eee">
      <tr style="background:#faf7f1">
        <th align="left" style="padding:8px 10px;font-size:11px;color:#8a857a;text-transform:uppercase;letter-spacing:.5px">Business</th>
        <th align="left" style="padding:8px 10px;font-size:11px;color:#8a857a;text-transform:uppercase;letter-spacing:.5px">Contact</th>
        <th align="left" style="padding:8px 10px;font-size:11px;color:#8a857a;text-transform:uppercase;letter-spacing:.5px">Email</th>
        <th align="left" style="padding:8px 10px;font-size:11px;color:#8a857a;text-transform:uppercase;letter-spacing:.5px">Phone</th>
        <th align="center" style="padding:8px 10px;font-size:11px;color:#8a857a;text-transform:uppercase;letter-spacing:.5px">Fields</th>
        <th align="left" style="padding:8px 10px;font-size:11px;color:#8a857a;text-transform:uppercase;letter-spacing:.5px">Started</th>
      </tr>
      ${tableRows}
    </table>
    <p style="color:#999;font-size:12px;margin:10px 0 0">
      &ldquo;Fields&rdquo; is how much of the 22-field form they completed - a high number is somebody who nearly
      finished and is worth a personal note.
    </p>` : `<p style="color:#777;font-size:14px">Nobody abandoned the form this week.</p>`}
    ${recoveredHtml}
    <p style="color:#999;font-size:12px;margin:18px 0 0">
      ${opts.openTotal} unfinished application${opts.openTotal === 1 ? '' : 's'} on file in total. Each business
      appears in this report once; it will not be repeated next week.
    </p>
  </div>`

  await sendResendEmail(ADMIN_ALERT_EMAILS, `Directory: ${count} unfinished application${count === 1 ? '' : 's'}`, html, 'Directory leads weekly report')
  void resend
}

export async function sendAbandonedJoinWeeklyReport(opts: {
  rows: { fullName: string; email: string; phone?: string; startedAt: string }[]
  // People who abandoned and later paid. Same rule as the Members page, so the
  // two never disagree: paid more than an hour after starting.
  recovered?: {
    thisWeek: { fullName: string; startedAt: string; paidAt: string; how: string }[]
    allTime: number
  }
}) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  const count = opts.rows.length

  const tableRows = opts.rows
    .map(r => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#0E0E0E;font-size:13px">${esc(r.fullName)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#555;font-size:13px">${r.email ? esc(r.email) : '-'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#555;font-size:13px">${r.phone ? esc(r.phone) : '-'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#999;font-size:12px">${new Date(r.startedAt).toLocaleDateString('en-GB')}</td>
        </tr>`)
    .join('')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto">
    <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 4px">Weekly join applications in progress</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px">
      <strong>${count}</strong> visitor${count === 1 ? '' : 's'} started joining BILD but ${count === 1 ? 'has' : 'have'} not
      completed payment. Consider following up.
    </p>
    ${count > 0 ? `
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 10px;color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #eee">Name</th>
          <th style="text-align:left;padding:8px 10px;color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #eee">Email</th>
          <th style="text-align:left;padding:8px 10px;color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #eee">Phone</th>
          <th style="text-align:left;padding:8px 10px;color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #eee">Started</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>` : ''}
    ${opts.recovered ? `
    <h2 style="color:#0E0E0E;font-size:18px;margin:28px 0 4px">Recovered sign-ups</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px">
      <strong>${opts.recovered.thisWeek.length}</strong> ${opts.recovered.thisWeek.length === 1 ? 'person' : 'people'} who had
      left without paying came back and paid in the last 7 days.
      <strong>${opts.recovered.allTime}</strong> recovered sign-up${opts.recovered.allTime === 1 ? '' : 's'} in total.
    </p>
    ${opts.recovered.thisWeek.length > 0 ? `
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 10px;color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #eee">Name</th>
          <th style="text-align:left;padding:8px 10px;color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #eee">Started</th>
          <th style="text-align:left;padding:8px 10px;color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #eee">Paid</th>
          <th style="text-align:left;padding:8px 10px;color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #eee">How</th>
        </tr>
      </thead>
      <tbody>${opts.recovered.thisWeek.map(r => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#0E0E0E;font-size:13px">${esc(r.fullName)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#999;font-size:12px">${new Date(r.startedAt).toLocaleDateString('en-GB')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#999;font-size:12px">${new Date(r.paidAt).toLocaleDateString('en-GB')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#555;font-size:13px">${esc(r.how)}</td>
        </tr>`).join('')}</tbody>
    </table>` : ''}` : ''}
    <p style="color:#999;font-size:12px;margin-top:14px">Full details are in the admin members list at bild.ae/admin/members?abandoned=1, and recovered sign-ups at bild.ae/admin/members?recovered=1.</p>
  </div>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: ADMIN_ALERT_EMAILS,
      subject: `Weekly join applications in progress (${count})${opts.recovered?.thisWeek.length ? `, ${opts.recovered.thisWeek.length} recovered this week` : ''}`,
      html,
    })
    if (result.error) {
      console.error('Abandoned join weekly report rejected by Resend:', result.error)
    }
  } catch (e) {
    console.error('Abandoned join weekly report failed:', e)
  }
}

// ---- Business directory listing-fee & Featured-upgrade emails ----
// Shared wrappers so this whole family of emails (payment prompts, renewal
// reminders, expiry notices - for both the base fee and Featured, member and
// admin copies) stays visually consistent with the rest of this file without
// repeating the same HTML shell a dozen times.

// `kicker` and `contact` default to the directory, which is where this shell
// started. Event mail passes its own, because a refund or waitlist email going
// out headed "BILD Business Directory" and pointing at the wrong inbox reads as
// a mistake to the member receiving it.
function bizEmailShell(opts: { heading: string; bodyHtml: string; ctaUrl?: string; ctaLabel?: string; secondaryUrl?: string; secondaryLabel?: string; kicker?: string; contact?: string }) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#0E0E0E;border-radius:16px;overflow:hidden">
    <div style="padding:32px 28px">
      <div style="color:#C8861A;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;text-align:center">${opts.kicker || 'BILD Business Directory'}</div>
      <h1 style="color:#F4F1EC;font-family:Georgia,serif;font-size:24px;margin:12px 0 16px;text-align:center">${opts.heading}</h1>
      <div style="color:#cfcabd;font-size:15px;line-height:1.6">${opts.bodyHtml}</div>
      ${opts.ctaUrl ? `<a href="${opts.ctaUrl}" style="display:inline-block;margin-top:20px;background:#C8861A;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:10px">${opts.ctaLabel || 'View'}</a>` : ''}
      ${opts.secondaryUrl ? `<p style="margin-top:12px"><a href="${opts.secondaryUrl}" style="color:#C8861A;font-size:13px;text-decoration:underline">${opts.secondaryLabel || 'View receipt'}</a></p>` : ''}
      <p style="color:#8a857a;font-size:12px;margin-top:18px">Questions? Reply or email ${opts.contact || 'connect@bild.ae'}</p>
    </div>
    <div style="background:#1a1a1a;padding:16px;text-align:center;color:#6b6b6b;font-size:11px">
      BILD · British Indians Living in Dubai · Established 2019
    </div>
  </div>`
}

function adminAlertShell(opts: { heading: string; bodyHtml: string }) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 4px">${opts.heading}</h2>
    <div style="color:#555;font-size:14px;line-height:1.6;margin:0 0 12px">${opts.bodyHtml}</div>
    <p style="color:#999;font-size:12px;margin-top:14px">Full details are in the admin business directory list.</p>
  </div>`
}

// True while an alert about a failed email is itself being sent, so a failure
// to deliver the alert cannot start a loop of alerts about alerts.
let sendingFailureAlert = false

// Tells the admin team an email could not be delivered.
//
// Failures used to go only to the server log, where nobody sees them. A member
// paid for an event ticket with a mistyped address, the confirmation could not
// be delivered, and the first anyone knew of it was when he said he had not
// received it.
async function alertEmailFailure(to: string | string[], errLabel: string, reason: string) {
  // Every failed send in this file funnels through here, so this is the one
  // place that has to tell Sentry. Recorded before the guard below, because
  // that guard deliberately suppresses the admin email when several sends
  // fail at once, and a burst of failures is exactly what we want to see.
  //
  // The recipient is deliberately not attached: it is a member's email
  // address, and it is already in the admin alert that goes out below.
  Sentry.captureException(new Error(`Email failed: ${errLabel}`), {
    tags: { email_kind: errLabel },
    contexts: { resend: { reason } },
  })

  if (sendingFailureAlert) return
  sendingFailureAlert = true
  // A failed ticket confirmation is an events problem, so it goes to the
  // people who can do something about it.
  const alertTo = /ticket|event|refund/i.test(errLabel) ? EVENTS_ALERT_EMAILS : ADMIN_ALERT_EMAILS
  try {
    const recipient = Array.isArray(to) ? to.join(', ') : to
    const html = adminAlertShell({
      heading: 'An email could not be delivered',
      bodyHtml: `
        <p><strong>${esc(errLabel)}</strong> could not be sent.</p>
        <p><strong>Intended recipient:</strong> ${esc(recipient)}</p>
        <p><strong>Reason given:</strong> ${esc(reason)}</p>
        <p>If this was a ticket or membership confirmation, the payment still went through. Check the address on
        the booking in the admin area, correct it, and resend the confirmation.</p>
      `,
    })
    const resend = new Resend(apiKey as string)
    await resend.emails.send({
      from: FROM,
      to: alertTo,
      subject: `BILD: an email could not be delivered (${errLabel})`,
      html,
    })
  } catch (e) {
    console.error('Could not send the email-failure alert:', e)
  } finally {
    sendingFailureAlert = false
  }
}

// Same as sendResendEmail but with the sending address stated, so the events
// mail goes out as events@bild.ae rather than the general inbox.
// A one-off message written in the admin and sent through BILD's own account,
// so it comes from the events inbox, carries BILD branding, and a reply reaches
// the people running the event.
//
// Unlike every other sender here this one returns the outcome instead of
// logging it. The admin pressing send is standing there waiting to know whether
// it went, and a silent failure is the whole reason the Emails tab exists.
export async function sendComposedEventEmail(opts: {
  to: string[]; subject: string; bodyText: string; bcc?: string[]
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!apiKey) return { ok: false, error: 'Email is not configured on this deployment.' }
  const resend = new Resend(apiKey)

  // Written as plain text in the admin. Blank lines become paragraphs and
  // single newlines become breaks, so nobody has to write HTML.
  const bodyHtml = opts.bodyText
    .split(/\n\s*\n/)
    .map(para => `<p>${esc(para.trim()).replace(/\n/g, '<br />')}</p>`)
    .join('')

  const html = bizEmailShell({
    kicker: 'BILD Events',
    contact: 'events@bild.ae',
    heading: opts.subject,
    bodyHtml,
  })

  try {
    const result = await resend.emails.send({
      from: EVENTS_FROM,
      to: opts.to,
      bcc: opts.bcc && opts.bcc.length ? opts.bcc : undefined,
      subject: opts.subject,
      html,
    })
    if (result.error) return { ok: false, error: result.error.message || String(result.error) }
    return { ok: true, id: result.data?.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// The addresses a composed message is blind-copied to, so BILD keeps its own
// record of anything sent by hand.
export function eventsAlertRecipients(): string[] {
  return EVENTS_ALERT_EMAILS
}

// The event filled up while somebody was paying, and their money has gone
// straight back. They did nothing wrong, so the email says so first and does
// not make them ask what happened.
export async function sendOversoldRefundEmail(opts: {
  to: string; firstName?: string; eventTitle: string; refundedAed: number; eventSlug?: string
}) {
  const first = esc(opts.firstName?.split(' ')[0] || 'there')
  const html = bizEmailShell({
    kicker: 'BILD Events',
    contact: 'events@bild.ae',
    heading: 'Your payment has been refunded',
    bodyHtml: `
      <p>Hi ${first},</p>
      <p>I am sorry. <strong>${esc(opts.eventTitle)}</strong> sold out in the moments while your payment was going
      through, so we could not hold your place.</p>
      <p>Your full payment of <strong>${opts.refundedAed} AED</strong> has already been sent back, including the card
      processing fee. Nothing is owed and there is nothing for you to do. It usually shows on a statement within five
      to ten working days, depending on the bank.</p>
      <p>This was our fault, not yours. If a place frees up we would like you to have first refusal, so do join the
      waitlist on the event page, and reply to this email if you would rather we added you ourselves.</p>
    `,
    ctaUrl: opts.eventSlug ? `https://www.bild.ae/events/${opts.eventSlug}` : undefined,
    ctaLabel: 'Join the waitlist',
  })
  await sendResendEmailFrom(EVENTS_FROM, opts.to, `Refunded: ${opts.eventTitle} sold out`, html, 'Oversold refund')
}

// Tells the events inbox that the cap did its job, or that it did not and
// somebody is holding money they should not be.
export async function sendOversoldAdminAlert(opts: {
  eventTitle: string; buyerName: string; buyerEmail: string; quantity: number
  capacity: number; alreadySold: number; refundedAed?: number; failure?: string
}) {
  const html = adminAlertShell({
    heading: opts.failure ? 'A sale broke the cap and could NOT be refunded' : 'A sale broke the cap and was refunded',
    bodyHtml: `
      <p><strong>${esc(opts.eventTitle)}</strong> is capped at ${opts.capacity} and had already sold
      ${opts.alreadySold}.</p>
      <p>${esc(opts.buyerName)} (${esc(opts.buyerEmail)}) paid for ${opts.quantity}
      ticket${opts.quantity === 1 ? '' : 's'}, which would have taken it past the cap.</p>
      ${opts.failure
        ? `<p style="color:#9B2226"><strong>The automatic refund failed:</strong> ${esc(opts.failure)}<br />
           They are holding tickets that do not exist. Refund them from the admin now.</p>`
        : `<p>Their ${opts.refundedAed} AED has been refunded in full, card fee included, and they have been emailed.
           The booking is closed and they are not on the door list.</p>`}
    `,
  })
  await sendResendEmailFrom(EVENTS_FROM, EVENTS_ALERT_EMAILS, `${opts.failure ? 'ACTION NEEDED: ' : ''}Over capacity: ${opts.eventTitle}`, html, 'Oversold admin alert')
}

// The daily ticket report, sent while any event is inside its four week
// run-up. One row per upcoming event with the sales and the money, so the
// state of the next event is known without opening the admin.
export async function sendEventSalesReport(opts: {
  rows: {
    title: string; date: string; daysAway: number; inWindow: boolean
    bookings: number; tickets: number; capacity: number | null; seatsLeft: number | null; waiting: number
    revenueAed: number; costsAed: number; profitAed: number
  }[]
  windowDays: number
}): Promise<{ ok: boolean; reason?: string }> {
  if (!apiKey) return { ok: false, reason: 'Email is not configured on this server (RESEND_API_KEY is not set).' }
  const resend = new Resend(apiKey)

  const aed = (n: number) => `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const th = 'padding:8px 10px;text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8a857a;border-bottom:1px solid #ddd6c7'
  const thR = `${th};text-align:right`
  const td = 'padding:10px;font-size:14px;color:#2E2E2E;border-bottom:1px solid #eee8db;vertical-align:top'
  const tdR = `${td};text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap`

  const soon = opts.rows.filter(r => r.inWindow)
  const later = opts.rows.filter(r => !r.inWindow)

  const rowHtml = (r: (typeof opts.rows)[number]) => {
    const notes: string[] = []
    if (r.capacity != null) notes.push(`${r.seatsLeft} of ${r.capacity} left`)
    if (r.waiting > 0) notes.push(`${r.waiting} waiting`)
    if (r.capacity == null) notes.push('no cap set')
    return `
    <tr>
      <td style="${td}">
        <strong>${esc(r.title)}</strong>
        <div style="color:#8a857a;font-size:12px;margin-top:2px">${day(r.date)} &middot; ${r.daysAway <= 0 ? 'today' : `in ${r.daysAway} day${r.daysAway === 1 ? '' : 's'}`}${notes.length ? ` &middot; ${notes.join(' &middot; ')}` : ''}</div>
      </td>
      <td style="${tdR}">${r.bookings}</td>
      <td style="${tdR}"><strong>${r.tickets}</strong></td>
      <td style="${tdR}">${aed(r.revenueAed)}</td>
      <td style="${tdR}">${aed(r.costsAed)}</td>
      <td style="${tdR};color:${r.profitAed < 0 ? '#9B2226' : '#3F6B37'};font-weight:bold">${aed(r.profitAed)}</td>
    </tr>`
  }

  const table = (rows: typeof opts.rows) => `
    <table style="width:100%;border-collapse:collapse;margin:6px 0 18px">
      <thead>
        <tr>
          <th style="${th}">Event</th>
          <th style="${thR}">Bookings</th>
          <th style="${thR}">Tickets</th>
          <th style="${thR}">Revenue</th>
          <th style="${thR}">Costs</th>
          <th style="${thR}">Profit</th>
        </tr>
      </thead>
      <tbody>${rows.map(rowHtml).join('')}</tbody>
    </table>`

  const totals = soon.reduce(
    (a, r) => ({ t: a.t + r.tickets, rev: a.rev + r.revenueAed, cost: a.cost + r.costsAed, pro: a.pro + r.profitAed }),
    { t: 0, rev: 0, cost: 0, pro: 0 },
  )

  const next = soon[0]
  const subject = next
    ? `BILD tickets: ${next.title} ${next.daysAway <= 0 ? 'is today' : `in ${next.daysAway} day${next.daysAway === 1 ? '' : 's'}`}, ${next.tickets} sold`
    : 'BILD tickets: daily report'

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#2E2E2E">
    <div style="color:#A86A10;font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:bold">BILD Events</div>
    <h1 style="font-family:Georgia,serif;font-size:22px;margin:6px 0 4px">Tickets sold per event</h1>
    <p style="color:#5C554A;font-size:14px;line-height:1.6;margin:0 0 18px">
      Sent daily while an event is inside its ${opts.windowDays} day run-up.
      ${soon.length} event${soon.length === 1 ? '' : 's'} in that window, together holding
      <strong>${totals.t}</strong> ticket${totals.t === 1 ? '' : 's'} and
      <strong>${aed(totals.pro)} AED</strong> of profit so far.
    </p>
    ${soon.length ? table(soon) : '<p style="color:#5C554A;font-size:14px">No events in the window.</p>'}
    ${later.length ? `
      <p style="color:#8a857a;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin:22px 0 0">Further ahead</p>
      ${table(later)}` : ''}
    <p style="color:#8a857a;font-size:12px;line-height:1.6;margin-top:4px">
      Tickets counts paid bookings only, so it matches the door list. Revenue is ticket money less refunds. Costs are
      the cost price of the tickets sold, plus anything booked against the event, plus the card fee not recovered from
      buyers. These are the same figures as the Money tab.
    </p>
    <p style="margin-top:16px">
      <a href="https://www.bild.ae/admin" style="background:#C8861A;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 22px;border-radius:8px;display:inline-block">Open the admin</a>
    </p>
  </div>`

  try {
    const result = await resend.emails.send({ from: EVENTS_FROM, to: EVENTS_ALERT_EMAILS, subject, html })
    if (result.error) return { ok: false, reason: result.error.message || String(result.error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
}

// A payment came in but could not be written to the money ledger. The customer
// is unaffected, but the Money tab and the daily report will be short by this
// sale until it is repaired, which the Stripe import on the Money page does.
export async function sendLedgerWriteFailedAlert(opts: {
  description: string; grossAed: number; stripeSessionId: string; reason: string
}) {
  const html = adminAlertShell({
    heading: 'A payment could not be recorded in the money ledger',
    bodyHtml: `
      <p><strong>${esc(opts.description)}</strong>, ${opts.grossAed} AED.</p>
      <p>The customer's payment went through and their booking is fine. Only the Money figures are missing this
      sale. Open the Money page and press <strong>Import from Stripe</strong> to add it back with the real fees.</p>
      <p style="color:#999;font-size:12px">Stripe session ${esc(opts.stripeSessionId)}<br />Reason: ${esc(opts.reason)}</p>
    `,
  })
  await sendResendEmailFrom(FROM, ADMIN_ALERT_EMAILS, `Money ledger missed a payment: ${opts.description}`, html, 'Ledger failure alert')
}

// A refund or chargeback that happened outside BILD's own admin screens,
// usually straight from the Stripe dashboard. The database has been brought
// back in line by the webhook; this tells the admins it happened, because
// nobody pressed a button on the website to cause it.
export async function sendExternalRefundAlert(opts: {
  kind: 'refund' | 'dispute'
  description: string
  refundedAed: number
  grossAed?: number
  closedBooking: boolean
  stripeChargeId: string
  unmatched?: boolean
}) {
  const isDispute = opts.kind === 'dispute'
  const html = adminAlertShell({
    heading: isDispute
      ? 'A customer has disputed a payment'
      : 'A refund was issued outside the website',
    bodyHtml: `
      <p><strong>${esc(opts.description)}</strong>, ${opts.refundedAed} AED${opts.grossAed ? ` of ${opts.grossAed} AED` : ''}.</p>
      ${isDispute
        ? `<p>Stripe is holding this money while the bank decides. Nothing has been changed on the website.
           Respond in the Stripe dashboard before the deadline, or the payment is lost automatically.</p>`
        : `<p>The Money dashboard has been updated to match Stripe.
           ${opts.closedBooking
             ? 'The booking has been closed, so they are off the door list and their seat is back on sale.'
             : 'The booking is still open, so they are still expected on the night.'}</p>`}
      ${opts.unmatched
        ? `<p style="color:#b45309"><strong>This payment could not be matched to anything in the database</strong>,
           so nothing was updated. Open the Money page and press <strong>Import from Stripe</strong>.</p>`
        : ''}
      <p style="color:#999;font-size:12px">Stripe charge ${esc(opts.stripeChargeId)}</p>
    `,
  })
  const subject = isDispute
    ? `Payment disputed: ${opts.description}`
    : `Refunded in Stripe: ${opts.description}`
  await sendResendEmailFrom(FROM, ADMIN_ALERT_EMAILS, subject, html, 'External refund alert')
}

// ---- Chasing an approved listing that was never paid for ----

export async function sendListingActivationReminder(opts: {
  to: string; businessName: string; ownerName?: string; feeAed: number; payUrl: string
}) {
  const first = esc(opts.ownerName?.split(' ')[0] || 'there')
  const html = bizEmailShell({
    heading: 'Your listing is not live yet',
    bodyHtml: `
      <p>Hi ${first}, <strong>${esc(opts.businessName)}</strong> was approved for the BILD Business
      Directory, but the listing fee has not been paid, so your profile is not yet visible to visitors.</p>
      <p>Your original payment link has nearly run out, so here is a fresh one. It is good for
      <strong>7 days</strong>.</p>
      <p style="color:#9a9384;font-size:14px">If we do not hear from you we will close the application off
      for now. You are welcome to get in touch at any time if you would still like to be listed.</p>`,
    ctaUrl: opts.payUrl,
    ctaLabel: `Pay ${opts.feeAed} AED & go live`,
  })
  await sendResendEmail(opts.to, `Reminder: activate your BILD listing`, html, 'Listing activation reminder')
}

export async function sendListingNeverPaidAdminAlert(opts: {
  businessName: string; approvedOn?: string | null
}) {
  const html = adminAlertShell({
    heading: `${esc(opts.businessName)} never paid for its listing`,
    bodyHtml: `
      <p>They were approved${opts.approvedOn ? ` on ${esc(new Date(opts.approvedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))}` : ''},
      sent a payment link, reminded with a second one, and neither was used.</p>
      <p>They have been archived as <strong>Applied but never paid</strong> and will not be chased again.
      Their listing is not live and never was.</p>
      <p>You can still bring them back: open the Directory, find them under
      <strong>Applied, never paid</strong>, and press <strong>Send payment link</strong>. That starts them
      over with a fresh link.</p>`,
  })
  await sendResendEmailFrom(FROM, ADMIN_ALERT_EMAILS, `Archived, never paid: ${opts.businessName}`, html, 'Listing never paid alert')
}

// ---- Testimonials a business collected from its own customers ----

export async function sendBusinessTestimonialAdminAlert(opts: {
  businessName: string; customerName: string; quote: string
}) {
  const html = adminAlertShell({
    heading: `${esc(opts.businessName)} sent in a customer testimonial`,
    bodyHtml: `
      <p style="margin:0 0 10px">From <strong>${esc(opts.customerName)}</strong></p>
      <p style="margin:0;font-style:italic">&ldquo;${esc(opts.quote)}&rdquo;</p>
      <p style="margin:12px 0 0">A screenshot of the original message is attached to it. Check that it
      matches before approving, in Admin &rarr; Business Testimonials.</p>`,
  })
  await sendResendEmailFrom(FROM, ADMIN_ALERT_EMAILS, `Testimonial to check: ${opts.businessName}`, html, 'Business testimonial alert')
}

export async function sendBusinessTestimonialApproved(opts: {
  to: string; businessName: string; customerName: string; profileUrl: string
}) {
  const html = bizEmailShell({
    heading: 'Your customer testimonial is live',
    bodyHtml: `
      <p>The testimonial from <strong>${esc(opts.customerName)}</strong> has been approved and is now
      showing on your ${esc(opts.businessName)} profile page.</p>
      <p>You can send in more at any time from your manage link.</p>`,
    ctaUrl: opts.profileUrl,
    ctaLabel: 'See it on your profile',
  })
  await sendResendEmail(opts.to, `Your testimonial from ${opts.customerName} is live`, html, 'Testimonial approved email')
}

export async function sendBusinessTestimonialDeclined(opts: {
  to: string; businessName: string; customerName: string; reason: string; manageUrl: string
}) {
  const html = bizEmailShell({
    heading: 'We could not publish that testimonial',
    bodyHtml: `
      <p>Thanks for sending in the testimonial from <strong>${esc(opts.customerName)}</strong> for
      ${esc(opts.businessName)}. We have not been able to publish this one.</p>
      <p style="background:#1a1a1a;border-left:3px solid #C8861A;padding:12px 14px;margin:16px 0">
        <strong style="color:#F4F1EC">Reason</strong><br />${esc(opts.reason)}
      </p>
      <p>You are very welcome to send it again once that is sorted, or send a different one.</p>`,
    ctaUrl: opts.manageUrl,
    ctaLabel: 'Send another testimonial',
  })
  await sendResendEmail(opts.to, `About the testimonial you sent for ${opts.businessName}`, html, 'Testimonial declined email')
}

async function sendResendEmailFrom(from: string, to: string | string[], subject: string, html: string, errLabel: string) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  try {
    const result = await resend.emails.send({ from, to, subject, html })
    if (result.error) {
      console.error(`${errLabel} rejected by Resend:`, result.error)
      await alertEmailFailure(to, errLabel, result.error.message || String(result.error))
    }
  } catch (e) {
    console.error(`${errLabel} failed:`, e)
    await alertEmailFailure(to, errLabel, e instanceof Error ? e.message : String(e))
  }
}

async function sendResendEmail(to: string | string[], subject: string, html: string, errLabel: string) {
  if (!apiKey) { console.warn('Email skipped: RESEND_API_KEY not set'); return }
  const resend = new Resend(apiKey)
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html })
    if (result.error) {
      console.error(`${errLabel} rejected by Resend:`, result.error)
      await alertEmailFailure(to, errLabel, result.error.message || String(result.error))
    }
  } catch (e) {
    console.error(`${errLabel} failed:`, e)
    await alertEmailFailure(to, errLabel, e instanceof Error ? e.message : String(e))
  }
}

export async function sendListingActivationEmail(opts: {
  to: string; businessName: string; ownerName?: string; feeAed: number; payUrl: string; featuredUrl: string
}) {
  const first = esc(opts.ownerName?.split(' ')[0] || 'there')
  const html = bizEmailShell({
    heading: `You're approved! 🎉`,
    bodyHtml: `
      <p>Hi ${first}, <strong>${esc(opts.businessName)}</strong> has been approved for the BILD Business Directory.</p>
      <p>To activate your listing and make it live, pay the annual listing fee of <strong>${opts.feeAed} AED/year</strong> below.</p>
      <p style="margin-top:16px"><a href="${opts.featuredUrl}" style="color:#C8861A">Want more visibility? Learn about Featured placement &rarr;</a></p>`,
    ctaUrl: opts.payUrl,
    ctaLabel: `Pay ${opts.feeAed} AED & Activate`,
  })
  await sendResendEmail(opts.to, `Approved! Activate your BILD listing`, html, 'Listing activation email')
}

export async function sendListingRenewalReminder(opts: { to: string; businessName: string; feeAed: number; payUrl: string }) {
  const html = bizEmailShell({
    heading: `Your listing renews in 14 days`,
    bodyHtml: `<p>Your BILD Business Directory listing for <strong>${esc(opts.businessName)}</strong> renews soon. Renew now for <strong>${opts.feeAed} AED/year</strong> to keep it live without interruption.</p>`,
    ctaUrl: opts.payUrl,
    ctaLabel: `Renew for ${opts.feeAed} AED`,
  })
  await sendResendEmail(opts.to, `Your BILD listing renews in 14 days`, html, 'Listing renewal reminder')
}

export async function sendListingRenewalAdminAlert(opts: { businessName: string; paidUntil: string }) {
  const html = adminAlertShell({
    heading: `Listing renews in 14 days: ${esc(opts.businessName)}`,
    bodyHtml: `<p>Current period ends ${esc(opts.paidUntil)}. A renewal reminder has been sent to the business.</p>`,
  })
  await sendResendEmail(ADMIN_ALERT_EMAILS, `Listing renewal in 14 days: ${opts.businessName}`, html, 'Listing renewal admin alert')
}

export async function sendListingFinalReminder(opts: { to: string; businessName: string; feeAed: number; payUrl: string }) {
  const html = bizEmailShell({
    heading: `Your listing renews tomorrow`,
    bodyHtml: `<p>Last call - your BILD Business Directory listing for <strong>${esc(opts.businessName)}</strong> renews tomorrow. Renew now for <strong>${opts.feeAed} AED/year</strong> to avoid your listing being hidden.</p>`,
    ctaUrl: opts.payUrl,
    ctaLabel: `Renew for ${opts.feeAed} AED`,
  })
  await sendResendEmail(opts.to, `Renews tomorrow: your BILD listing`, html, 'Listing final reminder')
}

export async function sendListingFinalReminderAdminAlert(opts: { businessName: string; paidUntil: string }) {
  const html = adminAlertShell({
    heading: `Listing renews tomorrow: ${esc(opts.businessName)}`,
    bodyHtml: `<p>Current period ends ${esc(opts.paidUntil)}. A final reminder has been sent to the business.</p>`,
  })
  await sendResendEmail(ADMIN_ALERT_EMAILS, `Listing renews tomorrow: ${opts.businessName}`, html, 'Listing final reminder admin alert')
}

export async function sendListingExpiredEmail(opts: { to: string; businessName: string; feeAed: number; payUrl: string }) {
  const html = bizEmailShell({
    heading: `Your listing has expired`,
    bodyHtml: `<p>Your BILD Business Directory listing for <strong>${esc(opts.businessName)}</strong> has expired and is no longer visible in the directory. Renew any time for <strong>${opts.feeAed} AED/year</strong> to go live again immediately.</p>`,
    ctaUrl: opts.payUrl,
    ctaLabel: `Renew for ${opts.feeAed} AED`,
  })
  await sendResendEmail(opts.to, `Your BILD listing has expired`, html, 'Listing expired email')
}

export async function sendListingExpiredAdminAlert(opts: { businessName: string }) {
  const html = adminAlertShell({
    heading: `Listing expired and hidden: ${esc(opts.businessName)}`,
    bodyHtml: `<p>This business's listing is no longer visible in the directory. They've been emailed a renewal link.</p>`,
  })
  await sendResendEmail(ADMIN_ALERT_EMAILS, `Listing expired: ${opts.businessName}`, html, 'Listing expired admin alert')
}

export async function sendListingPaidConfirmation(opts: { to: string; businessName: string; profileUrl: string; receiptUrl?: string; googleReviewsUrl?: string | null }) {
  const html = bizEmailShell({
    heading: `You're live! 🎉`,
    bodyHtml: `<p>Payment received - <strong>${esc(opts.businessName)}</strong> is now live in the BILD Business Directory.</p>${opts.googleReviewsUrl ? `
      <p>Have Google reviews? Show your star rating and reviews on your listing. Copy the <strong>Ask for reviews</strong> link
      from your Google Business Profile, then <a href="${opts.googleReviewsUrl}" style="color:#C8861A;font-weight:bold">add it here</a>.</p>` : ''}`,
    ctaUrl: opts.profileUrl,
    ctaLabel: 'View your listing',
    secondaryUrl: opts.receiptUrl,
    secondaryLabel: 'View your Stripe receipt',
  })
  await sendResendEmail(opts.to, `You're live in the BILD Business Directory!`, html, 'Listing paid confirmation')
}

export async function sendFeaturedUpgradeEmail(opts: { to: string; businessName: string; feeAed: number; featuredUrl: string }) {
  const html = bizEmailShell({
    heading: `Get Featured`,
    bodyHtml: `<p>Boost <strong>${esc(opts.businessName)}</strong>'s visibility in the BILD Business Directory - gold-highlighted placement, a richer profile page, and more, for <strong>${opts.feeAed} AED/quarter</strong>.</p>`,
    ctaUrl: opts.featuredUrl,
    ctaLabel: `Get Featured - ${opts.feeAed} AED`,
  })
  await sendResendEmail(opts.to, `Get Featured on BILD Business Directory`, html, 'Featured upgrade email')
}

// The monthly performance email.
//
// This is the renewal argument made for us. A business that sees "23 people
// tapped through to your website last month" renews without being chased; one
// that only ever hears from BILD when an invoice is due does not. Sent to
// Featured listings only - it is the benefit they are paying for.
export async function sendMonthlyStatsEmail(opts: {
  to: string
  businessName: string
  monthLabel: string
  views: number
  viewsPrev: number
  clicks: number
  clicksPrev: number
  breakdown: { label: string; count: number }[]
  manageUrl: string
}) {
  const delta = (now: number, before: number) => {
    if (before === 0) return now > 0 ? '<span style="color:#1d6b3a">new</span>' : ''
    const pct = Math.round(((now - before) / before) * 100)
    if (pct === 0) return '<span style="color:#8a857a">level</span>'
    return pct > 0
      ? `<span style="color:#1d6b3a">&#9650; ${pct}% on last month</span>`
      : `<span style="color:#8a857a">&#9660; ${Math.abs(pct)}% on last month</span>`
  }
  const rows = opts.breakdown.filter(b => b.count > 0)
  const breakdownHtml = rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:6px">
         ${rows.map(b => `<tr>
           <td style="padding:7px 0;border-bottom:1px solid #eee;color:#555;font-size:14px">${esc(b.label)}</td>
           <td style="padding:7px 0;border-bottom:1px solid #eee;color:#232323;font-size:14px;font-weight:bold;text-align:right">${b.count}</td>
         </tr>`).join('')}
       </table>`
    : `<p style="color:#777;font-size:14px;margin:6px 0 0">No click-throughs recorded this month.</p>`

  const html = bizEmailShell({
    heading: `Your BILD listing in ${esc(opts.monthLabel)}`,
    bodyHtml: `
      <p>Here is how <strong>${esc(opts.businessName)}</strong> performed in the BILD Business Directory last month.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:18px 0">
        <tr>
          <td style="width:50%;padding:14px;background:#faf7f1;border-radius:10px;vertical-align:top">
            <div style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1px">Profile views</div>
            <div style="color:#232323;font-size:30px;font-weight:bold;line-height:1.2">${opts.views}</div>
            <div style="font-size:12px">${delta(opts.views, opts.viewsPrev)}</div>
          </td>
          <td style="width:10px"></td>
          <td style="width:50%;padding:14px;background:#faf7f1;border-radius:10px;vertical-align:top">
            <div style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1px">Enquiries</div>
            <div style="color:#232323;font-size:30px;font-weight:bold;line-height:1.2">${opts.clicks}</div>
            <div style="font-size:12px">${delta(opts.clicks, opts.clicksPrev)}</div>
          </td>
        </tr>
      </table>
      <p style="color:#8a857a;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0">Where people went next</p>
      ${breakdownHtml}
      <p style="color:#777;font-size:12px;margin-top:18px">Repeat visits from the same person count once a day, and automated traffic is excluded, so these are real people.</p>`,
    ctaUrl: opts.manageUrl,
    ctaLabel: 'Manage your listing',
  })
  await sendResendEmail(opts.to, `Your BILD listing in ${opts.monthLabel}: ${opts.views} views`, html, 'Monthly listing stats')
}

export async function sendFeaturedPaidConfirmation(opts: { to: string; businessName: string; manageUrl: string; receiptUrl?: string }) {
  const html = bizEmailShell({
    heading: `You're Featured! ⭐`,
    bodyHtml: `<p>Payment received - <strong>${esc(opts.businessName)}</strong> is now Featured in the BILD Business Directory for the next 3 months.</p><p>Add an extended bio, photos, video, and multiple offers to make the most of it:</p>`,
    ctaUrl: opts.manageUrl,
    ctaLabel: 'Manage your Featured content',
    secondaryUrl: opts.receiptUrl,
    secondaryLabel: 'View your Stripe receipt',
  })
  await sendResendEmail(opts.to, `You're Featured on BILD Business Directory!`, html, 'Featured paid confirmation')
}

// Sends a business its standing link to manage its Featured content.
//
// A business that pays for Featured gets this link in its payment email. One
// made Featured by an admin never paid, so it never got one, and had no way to
// add a bio, photos, video, offers or a brochure. This is how an admin sends it.
// Returns the outcome so the admin is told whether it actually went.
// The manage link now goes to every approved business, not only Featured ones,
// because the page it opens carries the customer testimonials form as well as
// the Featured content. So the email has to say different things to the two:
// telling a business that has never paid for Featured that it is Featured, and
// listing perks it does not have, is worse than sending nothing.
export async function sendFeaturedManageLinkEmail(opts: {
  to: string; businessName: string; manageUrl: string; featured?: boolean
}): Promise<{ ok: boolean; reason?: string }> {
  if (!apiKey) return { ok: false, reason: 'Email is not configured on this server (RESEND_API_KEY is not set).' }
  const resend = new Resend(apiKey)

  const keepSafe = `<p style="color:#9a9384;font-size:14px">This link is personal to your listing and does not
      expire, so keep this email somewhere safe. Anyone with the link can manage your listing.</p>`

  const featured = opts.featured !== false
  const heading = featured ? 'Manage your Featured listing' : 'Manage your listing'
  const subject = featured
    ? 'Manage your Featured listing on BILD Business Directory'
    : 'Manage your BILD Business Directory listing'

  const html = bizEmailShell({
    heading,
    bodyHtml: featured
      ? `
      <p><strong>${esc(opts.businessName)}</strong> is Featured in the BILD Business Directory.</p>
      <p>Use the link below to make the most of it. You can add an extended bio, up to 6 photos, a video, your BILD
      member offers, and a PDF brochure that visitors can download from your profile.</p>
      <p>You can also send us testimonials your customers have given you. Add their name, what they said, and a
      screenshot of the original message, and we will check it and put it on your profile.</p>
      ${keepSafe}`
      : `
      <p>This is your own page for managing how <strong>${esc(opts.businessName)}</strong> appears in the BILD
      Business Directory.</p>
      <p>Right now you can use it to send us <strong>testimonials your customers have given you</strong>. Add their
      name, what they said, and a screenshot of the original email, WhatsApp or text so we can check it is genuine.
      Once approved it appears on your profile page. The screenshot is only ever seen by BILD, never by visitors.</p>
      <p>Featured listings can also add an extended bio, photos, a video, member offers and a downloadable brochure.
      There is a link on the page if you would like to know more.</p>
      ${keepSafe}`,
    ctaUrl: opts.manageUrl,
    ctaLabel: featured ? 'Manage your listing' : 'Send a customer testimonial',
  })
  try {
    const result = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject,
      html,
    })
    if (result.error) {
      await alertEmailFailure(opts.to, 'Featured manage link', result.error.message || String(result.error))
      return { ok: false, reason: result.error.message || String(result.error) }
    }
    return { ok: true }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    await alertEmailFailure(opts.to, 'Featured manage link', reason)
    return { ok: false, reason }
  }
}

// Where test sends of a campaign go: the owner's inbox if set, otherwise the
// admin list. Never a business.
export function testRecipients(): string[] {
  return OWNER_ALERT_EMAILS.length ? OWNER_ALERT_EMAILS : ADMIN_ALERT_EMAILS
}

// Invites a directory business to switch on Google reviews, with a personal
// button to the page where it pastes its own link. Returns the outcome so the
// admin send page can show exactly who it reached.
export async function sendGoogleReviewsInviteEmail(opts: {
  to: string | string[]
  ownerName?: string | null
  businessName: string
  slug: string
  linkUrl: string
  brokenLink: boolean
  subjectPrefix?: string
}): Promise<{ ok: boolean; reason?: string }> {
  if (!apiKey) return { ok: false, reason: 'Email is not configured on this server (RESEND_API_KEY is not set).' }
  const resend = new Resend(apiKey)
  const first = esc((opts.ownerName || '').trim().split(/\s+/)[0] || 'there')
  const name = esc(opts.businessName)
  const profileUrl = `https://www.bild.ae/directory/${opts.slug}`

  const opening = opts.brokenLink
    ? `<p>When you listed <strong>${name}</strong> you sent us a Google link, but it is a type Google does not let us read
       reviews from, so your reviews are not showing yet. Here is the link we need instead, and you can now add it
       yourself.</p>`
    : `<p>Your listing for <strong>${name}</strong> in the BILD Business Directory can now show your Google star rating and
       reviews. Your rating appears next to your business name, and your reviews show on your profile page with a link
       for customers to leave a new one.</p>`

  const html = bizEmailShell({
    heading: 'Show your Google reviews on BILD',
    bodyHtml: `
      <p>Hi ${first},</p>
      ${opening}
      <p>It is free and takes about two minutes:</p>
      <ol style="padding-left:20px;margin:0 0 14px">
        <li style="margin-bottom:8px">Open your Google Business Profile. Search for your business name on Google while signed in, or go to business.google.com</li>
        <li style="margin-bottom:8px">Click <strong>Ask for reviews</strong>. On some screens it is called <strong>Get more reviews</strong></li>
        <li style="margin-bottom:8px">Copy the link it shows you. It starts with <strong>g.page/r/</strong></li>
        <li>Press the button below and paste it in. Your reviews appear on your listing straight away</li>
      </ol>
      <p style="color:#9a9384;font-size:14px">Please use that exact link. A link copied from Google search results or Google
      Maps will not work, and the page will tell you if you have pasted the wrong one.</p>
      <p style="color:#9a9384;font-size:14px">This button is personal to your listing. Keep this email if you might want to
      update your link later. Your listing: <a href="${profileUrl}" style="color:#C8861A">${profileUrl}</a></p>
    `,
    ctaUrl: opts.linkUrl,
    ctaLabel: 'Add your Google reviews',
  })

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `${opts.subjectPrefix || ''}Show your Google reviews on your BILD directory listing`,
      html,
    })
    if (result.error) return { ok: false, reason: result.error.message || String(result.error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
}

// Tells the admin team a business has switched Google reviews on by itself.
export async function sendGoogleReviewsActivatedAlert(opts: {
  businessName: string
  slug: string
  rating: number | null
  totalReviews: number | null
  googleLink: string
  replacedExisting: boolean
}) {
  const profileUrl = `https://www.bild.ae/directory/${opts.slug}`
  const html = adminAlertShell({
    heading: `${esc(opts.businessName)} ${opts.replacedExisting ? 'updated' : 'switched on'} Google reviews`,
    bodyHtml: `
      <p>${opts.rating != null
        ? `Their listing now shows <strong>${opts.rating.toFixed(1)} stars from ${opts.totalReviews} Google reviews</strong>.`
        : 'Their Google business was found, but it has no reviews yet. The rating will appear once it does.'}</p>
      <p><a href="${profileUrl}">View their listing</a> &middot; <a href="${esc(opts.googleLink)}">The Google link they added</a></p>
      <p style="color:#999;font-size:12px">If this looks wrong, change or clear the Google review link in Edit business.</p>
    `,
  })
  await sendResendEmail(ADMIN_ALERT_EMAILS, `Google reviews ${opts.replacedExisting ? 'updated' : 'switched on'}: ${opts.businessName}`, html, 'Google reviews activated alert')
}

export async function sendFeaturedRenewalReminder(opts: { to: string; businessName: string; feeAed: number; featuredUrl: string }) {
  const html = bizEmailShell({
    heading: `Your Featured status renews in 14 days`,
    bodyHtml: `<p><strong>${esc(opts.businessName)}</strong>'s Featured placement renews soon. Renew for <strong>${opts.feeAed} AED/quarter</strong> to keep your boosted visibility and profile content live.</p>`,
    ctaUrl: opts.featuredUrl,
    ctaLabel: `Renew for ${opts.feeAed} AED`,
  })
  await sendResendEmail(opts.to, `Your Featured placement renews in 14 days`, html, 'Featured renewal reminder')
}

export async function sendFeaturedRenewalAdminAlert(opts: { businessName: string; paidUntil: string }) {
  const html = adminAlertShell({
    heading: `Featured renews in 14 days: ${esc(opts.businessName)}`,
    bodyHtml: `<p>Current period ends ${esc(opts.paidUntil)}. A renewal reminder has been sent to the business.</p>`,
  })
  await sendResendEmail(ADMIN_ALERT_EMAILS, `Featured renewal in 14 days: ${opts.businessName}`, html, 'Featured renewal admin alert')
}

export async function sendFeaturedFinalReminder(opts: { to: string; businessName: string; feeAed: number; featuredUrl: string }) {
  const html = bizEmailShell({
    heading: `Your Featured status renews tomorrow`,
    bodyHtml: `<p>Last call - <strong>${esc(opts.businessName)}</strong>'s Featured placement renews tomorrow. Renew for <strong>${opts.feeAed} AED/quarter</strong> to avoid losing your boosted visibility.</p>`,
    ctaUrl: opts.featuredUrl,
    ctaLabel: `Renew for ${opts.feeAed} AED`,
  })
  await sendResendEmail(opts.to, `Renews tomorrow: your Featured placement`, html, 'Featured final reminder')
}

export async function sendFeaturedFinalReminderAdminAlert(opts: { businessName: string; paidUntil: string }) {
  const html = adminAlertShell({
    heading: `Featured renews tomorrow: ${esc(opts.businessName)}`,
    bodyHtml: `<p>Current period ends ${esc(opts.paidUntil)}. A final reminder has been sent to the business.</p>`,
  })
  await sendResendEmail(ADMIN_ALERT_EMAILS, `Featured renews tomorrow: ${opts.businessName}`, html, 'Featured final reminder admin alert')
}

export async function sendFeaturedExpiredEmail(opts: { to: string; businessName: string; feeAed: number; featuredUrl: string }) {
  const html = bizEmailShell({
    heading: `Your Featured status has expired`,
    bodyHtml: `<p><strong>${esc(opts.businessName)}</strong>'s Featured placement has expired - your listing is still live, just without the gold highlight and extra profile content. Renew any time for <strong>${opts.feeAed} AED/quarter</strong>.</p>`,
    ctaUrl: opts.featuredUrl,
    ctaLabel: `Renew for ${opts.feeAed} AED`,
  })
  await sendResendEmail(opts.to, `Your Featured placement has expired`, html, 'Featured expired email')
}

export async function sendFeaturedExpiredAdminAlert(opts: { businessName: string }) {
  const html = adminAlertShell({
    heading: `Featured expired: ${esc(opts.businessName)}`,
    bodyHtml: `<p>This business is no longer Featured (still listed, just without the boost). They've been emailed a renewal link.</p>`,
  })
  await sendResendEmail(ADMIN_ALERT_EMAILS, `Featured expired: ${opts.businessName}`, html, 'Featured expired admin alert')
}

// Admin alert whenever a member submits a testimonial for review.
export async function sendTestimonialSubmittedAdminAlert(opts: { name: string; quote: string; rating: number; businessName?: string }) {
  // A review left against a directory business, or a testimonial about BILD itself.
  const subject = opts.businessName
    ? `New review for ${opts.businessName}: ${opts.name}`
    : `New testimonial submitted: ${opts.name}`
  const html = adminAlertShell({
    heading: esc(subject),
    bodyHtml: `
      ${opts.businessName ? `<p style="margin:0 0 10px">Review of <strong>${esc(opts.businessName)}</strong></p>` : ''}
      <p style="margin:0 0 10px">${'⭐'.repeat(opts.rating)}${'☆'.repeat(5 - opts.rating)}</p>
      <p style="margin:0;font-style:italic">&ldquo;${esc(opts.quote)}&rdquo;</p>
      <p style="margin:12px 0 0">Approve or reject it in Admin &rarr; Testimonials.</p>`,
  })
  await sendResendEmail(ADMIN_ALERT_EMAILS, subject, html, 'Testimonial submitted admin alert')
}

// Tells a directory business that a review of them has been approved and is now
// live on their profile. Sent on approval rather than on submission, so a
// business is never notified about a review that then gets rejected.
// The reviewer's email/phone are deliberately NOT included - those are held for
// BILD admins to verify authenticity, not to pass on to the business.
export async function sendBusinessReviewNotification(opts: {
  to: string; businessName: string; reviewerName: string; rating: number; quote: string; profileUrl: string
}) {
  const stars = `${'⭐'.repeat(opts.rating)}${'☆'.repeat(5 - opts.rating)}`
  const html = bizEmailShell({
    heading: `You have a new BILD review ⭐`,
    bodyHtml: `
      <p>Someone from the BILD community has left a review for <strong>${esc(opts.businessName)}</strong>, and it is now live on your directory profile.</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:16px 18px;margin:16px 0">
        <p style="margin:0 0 8px;font-size:16px">${stars}</p>
        <p style="margin:0;font-style:italic;color:#cfcabd">&ldquo;${esc(opts.quote)}&rdquo;</p>
        <p style="margin:10px 0 0;color:#8a857a;font-size:13px">- ${esc(opts.reviewerName)}</p>
      </div>
      <p style="font-size:14px">All reviews are checked by the BILD team before they appear. If you think this review is unfair or mistaken, reply to this email and we will look into it.</p>`,
    ctaUrl: opts.profileUrl,
    ctaLabel: 'View your profile',
  })
  await sendResendEmail(opts.to, `New BILD review for ${opts.businessName}`, html, 'Business review notification')
}

export async function sendGetFeaturedLinkEmail(opts: { to: string; businessName: string; featuredUrl: string }) {
  const html = bizEmailShell({
    heading: `Your Get Featured link`,
    bodyHtml: `<p>Here's your link to upgrade <strong>${esc(opts.businessName)}</strong> to Featured on the BILD Business Directory.</p>`,
    ctaUrl: opts.featuredUrl,
    ctaLabel: 'Get Featured',
  })
  await sendResendEmail(opts.to, `Your BILD Get Featured link`, html, 'Get Featured link email')
}

