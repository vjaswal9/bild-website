'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-50 w-11 h-11 bg-gold-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-gold-600 transition-all hover:-translate-y-0.5 hover:shadow-xl"
      aria-label="Back to top"
    >
      <ArrowUp size={20} />
    </button>
  )
}
