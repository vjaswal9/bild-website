import type { MetadataRoute } from 'next'

// Lets a member save BILD to their phone home screen, which matters for a
// community that checks event dates and WhatsApp links on a phone. The icons
// already existed; only this file was missing.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BILD: British Indians Living in Dubai',
    short_name: 'BILD',
    description:
      'A membership network connecting British Indians in the UAE through culture, connection, and commerce.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FDF8F0',
    theme_color: '#C8861A',
    lang: 'en-GB',
    categories: ['social', 'lifestyle', 'business'],
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
    ],
  }
}
