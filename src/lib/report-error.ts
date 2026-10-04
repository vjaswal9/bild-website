import * as Sentry from '@sentry/nextjs'

// Logs a handled failure AND tells Sentry about it.
//
// A route that catches an error and answers with a friendly 500 is invisible
// to Sentry on its own: nothing was thrown past it. Several public routes did
// exactly that and only wrote a console line, which nobody reads until
// someone complains. Use this wherever a failed write means a person's
// submission, payment or booking did not save.
export function reportError(label: string, err: unknown, tags?: Record<string, string>) {
  console.error(label, err)
  try {
    const error = err instanceof Error
      ? err
      : new Error(`${label}: ${typeof err === 'string' ? err : JSON.stringify(err)}`)
    Sentry.captureException(error, { tags: { flow: label.slice(0, 60), ...tags } })
  } catch {
    // Reporting must never be the thing that breaks the request.
  }
}
