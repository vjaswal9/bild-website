import * as Sentry from '@sentry/nextjs'

// Production only. Local development throws off noise that isn't worth
// alerting on (dev server restarts, HMR drops) and would eat into the free
// tier's monthly event budget.
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Preview deployments report into the same project as production, so
    // without this an alert could not be trusted to mean the live site is
    // broken.
    environment: process.env.VERCEL_ENV || 'development',
    tracesSampleRate: 0.1,
  })
}
