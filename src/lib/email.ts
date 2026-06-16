import { Resend } from 'resend'

// Welcome email is optional: only sends if RESEND_API_KEY is configured.
const apiKey = process.env.RESEND_API_KEY
const FROM = process.env.RESEND_FROM || 'BILD <connect@bild.ae>'

export async function sendWelcomeEmail(opts: { to: string; name?: string; inviteUrl: string }) {
  if (!apiKey) return // email disabled until a key is set
  const resend = new Resend(apiKey)
  const first = opts.name?.split(' ')[0] || 'there'

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#0E0E0E;border-radius:16px;overflow:hidden">
    <div style="padding:32px 28px;text-align:center">
      <div style="color:#C8A64B;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:bold">Welcome to BILD</div>
      <h1 style="color:#F4F1EC;font-family:Georgia,serif;font-size:28px;margin:12px 0 8px">You're in, ${first}! 🎉</h1>
      <p style="color:#cfcabd;font-size:15px;line-height:1.6;margin:0 0 24px">
        Your 50 AED lifetime membership is confirmed. Tap below to join your BILD WhatsApp group.
        This link is just for you and can only be used once.
      </p>
      <a href="${opts.inviteUrl}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:12px">
        Join your BILD WhatsApp group
      </a>
      <p style="color:#8a857a;font-size:12px;margin-top:20px">
        The link expires in 48 hours. Trouble joining? Reply or email connect@bild.ae
      </p>
    </div>
    <div style="background:#1a1a1a;padding:16px;text-align:center;color:#6b6b6b;font-size:11px">
      BILD · British Indians Living in Dubai · Established 2019
    </div>
  </div>`

  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: 'Welcome to BILD — your WhatsApp group invite',
      html,
    })
  } catch (e) {
    // Don't let email failure break the webhook
    console.error('Welcome email failed:', e)
  }
}
