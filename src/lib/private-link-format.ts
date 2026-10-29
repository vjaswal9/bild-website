// Pure text helpers for private ticket links, shared by the server and the
// admin screen (so nothing here may touch the database).

// Dubai is where the people holding these links are, whatever the admin's own clock says.
export const dubaiWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai',
  })

// The message the admin sends by hand (WhatsApp or email), with the link in it.
export function inviteMessage(opts: { name: string; eventTitle: string; url: string; expiresAt: string }) {
  const first = opts.name.trim().split(/\s+/)[0] || 'there'
  return [
    `Hi ${first},`,
    '',
    `You are invited to ${opts.eventTitle}. Here is your personal link to buy your ticket (sold through our official ticketing partner, Ticketsfy):`,
    opts.url,
    '',
    `This link is just for you. It works once and expires on ${dubaiWhen(opts.expiresAt)} (Dubai time), so please only open it when you are ready to book. Please do not forward it: once it has been used, it cannot be used again.`,
    '',
    'If you have any problems, just message me here.',
    '',
    'BILD Events',
  ].join('\n')
}

// A phone number as WhatsApp wants it: digits only, with the country code.
// A UAE mobile typed the local way (050 123 4567) gets 971 put on the front.
export function whatsappDigits(phone: string | null | undefined) {
  let d = String(phone || '').replace(/[^\d]/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0') && d.length === 10) d = '971' + d.slice(1)
  return d.length >= 8 ? d : ''
}
