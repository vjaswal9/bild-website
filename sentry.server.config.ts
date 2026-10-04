import * as Sentry from '@sentry/nextjs'
import { scrubEvent } from './src/lib/sentry-scrub'

// The server variable, or the public one the Vercel integration also sets.
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

// Production only. Local development throws off noise that isn't worth
// alerting on (dev server restarts, HMR drops) and would eat into the free
// tier's monthly event budget.
if (dsn && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn,
    // Preview deployments report into the same project as production, so
    // without this an alert could not be trusted to mean the live site is
    // broken.
    environment: process.env.VERCEL_ENV || 'development',
    tracesSampleRate: 0.1,
    // Private-link tokens, emails and cookies never leave the server.
    beforeSend: event => scrubEvent(event),
    beforeSendTransaction: event => scrubEvent(event),
  })
}
