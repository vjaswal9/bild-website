import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PageTransition from '@/components/ui/PageTransition'
import BackToTop from '@/components/ui/BackToTop'
import ScrollProgress from '@/components/ui/ScrollProgress'
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics'
import { SITE_CONFIG } from '@/data/config'

const SITE_URL = 'https://www.bild.ae'

// Self-hosted at build time by next/font, so there is no render-blocking
// round trip to Google before the first paint. Exposed as CSS variables that
// tailwind.config.ts maps onto font-sans / font-display.
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_CONFIG.siteName}: ${SITE_CONFIG.siteTagline}`,
    template: `%s | ${SITE_CONFIG.siteName}`,
  },
  description: SITE_CONFIG.siteDescription,
  alternates: { canonical: './' },
  // Deliberately no title/description/url here. Next.js merges metadata
  // shallowly: if this block pinned them, every page would inherit the
  // homepage's values and share with the wrong title and the wrong og:url,
  // which stops WhatsApp/LinkedIn previewing sub-pages properly. Left unset,
  // each page's own title and description flow through, and the relative
  // './' url resolves per route against metadataBase (same as canonical above).
  openGraph: {
    type: 'website',
    url: './',
    siteName: SITE_CONFIG.siteName,
    locale: 'en_GB',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BILD, British Indians Living in Dubai' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#C8861A',
}

// Machine-readable identity for search and answer engines. The explicit
// @id, address, and Google Business Profile link (sameAs) exist to help
// Google resolve this as a distinct entity from bild.de (the unrelated
// German publication), which otherwise tends to dominate the bare "BILD"
// query - see the SEO discussion this was added for.
// Also typed as LocalBusiness (in addition to Organization) so Google's
// local-pack/Maps ranking has structured geo/hours/phone signals to work
// with, not just the generic entity data above.
const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': ['Organization', 'LocalBusiness'],
  '@id': `${SITE_URL}/#organization`,
  name: 'BILD',
  alternateName: ['British Indians Living in Dubai', 'BILD Dubai', 'BILD UAE'],
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  image: `${SITE_URL}/icon.png`,
  email: SITE_CONFIG.contactEmail,
  telephone: '+971529763444',
  foundingDate: '2019',
  description: SITE_CONFIG.siteDescription,
  areaServed: 'Dubai, United Arab Emirates',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Dubai',
    addressCountry: 'AE',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 25.0760224,
    longitude: 55.227488,
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    opens: '00:00',
    closes: '23:59',
  },
  sameAs: [
    SITE_CONFIG.instagramUrl,
    SITE_CONFIG.facebookUrl,
    SITE_CONFIG.linkedinUrl,
    'https://www.google.com/maps/place/?q=place_id:ChIJYT-Lv_ENhkIROZHEImwgC4g',
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <GoogleAnalytics />
        <ScrollProgress />
        <Navbar />
        <main className="flex-1 pt-20 md:pt-24"><PageTransition>{children}</PageTransition></main>
        <Footer />
        <BackToTop />
      </body>
    </html>
  )
}
