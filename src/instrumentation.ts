// Next.js calls register() once when the server starts (both the Node
// runtime and the Edge runtime, e.g. middleware). This is where server-side
// Sentry error monitoring gets wired in - see sentry.server.config.ts and
// sentry.edge.config.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}
