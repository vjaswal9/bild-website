// The mobile number a booker gives to show they are a BILD member. This only
// checks that it looks like a phone number (7 to 15 digits, which covers every
// international format); it does not look the number up. Used by the event
// booking form and, again, by the checkout API, so a script cannot skip it.
export function isPlausibleMobile(value: string): boolean {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}
