'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable - nothing we can do silently
    }
  }

  return (
    <button
      onClick={copy}
      className="ml-auto inline-flex items-center gap-1.5 bg-gold-100 hover:bg-gold-200 text-charcoal-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
    >
      {copied ? <Check size={16} className="text-green-600" /> : <Link2 size={16} />}
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}
