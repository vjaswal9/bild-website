import * as Sentry from '@sentry/nextjs'

// Production only - see the note in sentry.server.config.ts.
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
