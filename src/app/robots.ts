import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/j/'],
    },
    sitemap: 'https://www.bild.ae/sitemap.xml',
  }
}
