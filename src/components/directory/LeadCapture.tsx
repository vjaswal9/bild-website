'use client'

import { useEffect, useRef } from 'react'
import { isValidEmail } from '@/lib/email-validate'

// Saves a partly-filled directory application as the visitor types.
//
// The membership form has always done this - JoinForm writes a `members` row
// at the eligibility step, so anyone who leaves before paying stays visible and
// can be followed up. The directory form could not: it is one page of 22 fields
// that only wrote a row on the final submit, so somebody who filled in fifteen
// of them and closed the tab left nothing behind. A form that long is exactly
// where drop-off is worst.
//
// The form is uncontrolled and submits via FormData, so this reads the live
// form rather than duplicating its state - which also means it keeps working if
// a field is added or renamed.
//
// Nothing is sent until there is a valid email address. A lead nobody can
// contact is not worth keeping, and storing details typed by someone who never
// got as far as an email would be hard to justify.
const DEBOUNCE_MS = 1500

export default function LeadCapture({
  formRef,
  done,
}: {
  formRef: React.RefObject<HTMLFormElement | null>
  // True once the application has actually been submitted. The submit route
  // closes the lead off server-side; this just stops further saves.
  done: boolean
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSent = useRef('')

  useEffect(() => {
    const form = formRef.current
    if (!form || done) return

    const send = () => {
      const fd = new FormData(form)
      const get = (k: string) => {
        const v = fd.get(k)
        return typeof v === 'string' ? v.trim() : ''
      }
      const email = get('email')
      if (!email || !isValidEmail(email)) return

      // How far they got, so the weekly digest can say how complete it was
      // rather than only naming them.
      // forEach rather than for..of: this project's TS target does not allow
      // iterating a FormData iterator directly.
      let filled = 0
      fd.forEach(v => { if (typeof v === 'string' && v.trim()) filled++ })

      const payload = {
        email,
        business_name: get('business_name'),
        owner_name: get('owner_name'),
        phone: get('phone'),
        category: get('category'),
        location: get('location'),
        fields_filled: filled,
      }
      // Nothing has changed since the last save, so do not send it again.
      const sig = JSON.stringify(payload)
      if (sig === lastSent.current) return
      lastSent.current = sig

      try {
        fetch('/api/directory/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: sig,
          keepalive: true,
        }).catch(() => {})
      } catch {
        // Never let this surface to the person filling the form in.
      }
    }

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(send, DEBOUNCE_MS)
    }

    // 'blur' in the capture phase, because blur does not bubble. Between them
    // these cover typing, tabbing away, and picking from a select.
    form.addEventListener('blur', schedule, true)
    form.addEventListener('change', schedule)
    form.addEventListener('input', schedule)

    // A pending save would otherwise be lost when the tab closes - which is
    // precisely the visitor this feature exists to catch.
    const flush = () => {
      if (timer.current) clearTimeout(timer.current)
      send()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })

    return () => {
      if (timer.current) clearTimeout(timer.current)
      form.removeEventListener('blur', schedule, true)
      form.removeEventListener('change', schedule)
      form.removeEventListener('input', schedule)
      window.removeEventListener('pagehide', flush)
    }
  }, [formRef, done])

  return null
}
