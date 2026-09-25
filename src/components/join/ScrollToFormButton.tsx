'use client'

import { btnPrimary } from '@/lib/ui'

export default function ScrollToFormButton() {
  return (
    <button
      onClick={() => document.getElementById('application')?.scrollIntoView({ behavior: 'smooth' })}
      className={`${btnPrimary} w-full py-4 text-lg`}
    >
      Start your application
    </button>
  )
}
