import Script from 'next/script'

// Only enabled once NEXT_PUBLIC_GA_MEASUREMENT_ID is set (in Vercel's
// environment variables) - renders nothing locally or if it isn't configured.
export default function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  if (!id) return null

  return (
    <>
      {/* Warms up the connection so the analytics request isn't paying for a
          fresh DNS + TLS handshake when it fires. */}
      <link rel="preconnect" href="https://www.googletagmanager.com" />
      <link rel="preconnect" href="https://www.google-analytics.com" />
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  )
}
