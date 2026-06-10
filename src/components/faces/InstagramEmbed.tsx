'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } }
  }
}

export default function InstagramEmbed({ url }: { url: string }) {
  useEffect(() => {
    const id = 'instagram-embed-script'
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.id = id
      s.src = 'https://www.instagram.com/embed.js'
      s.async = true
      document.body.appendChild(s)
    } else if (window.instgrm) {
      window.instgrm.Embeds.process()
    }
    // Process again shortly after mount in case the script is already loaded
    const t = setTimeout(() => window.instgrm?.Embeds.process(), 400)
    return () => clearTimeout(t)
  }, [url])

  return (
    <blockquote
      className="instagram-media"
      data-instgrm-permalink={url}
      data-instgrm-version="14"
      style={{
        background: '#fff',
        border: 0,
        borderRadius: 12,
        margin: 0,
        width: '100%',
        maxWidth: 340,
        minWidth: 0,
      }}
    />
  )
}
