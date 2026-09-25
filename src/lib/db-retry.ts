import * as Sentry from '@sentry/nextjs'

// Runs a database read, and if it fails, waits a moment and tries once more.
//
// Written after a buyer on the Lads Evening Brunch was told the event did not
// exist, twice, for about a minute, while the event was live and selling. The
// read of the event had failed, and the code treated "could not read it" as
// "it is not there". Nothing was logged, so it looked like the event had
// vanished.
//
// Two rules follow. A failed read is retried once, because most failures are a
// dropped connection that the second attempt gets past. And a read that still
// fails is returned as an error and logged, never as empty data, so the caller
// can say "try again" rather than "not found".
export async function readWithRetry<R extends { error: unknown }>(
  label: string,
  run: () => PromiseLike<R>,
): Promise<R> {
  const attempt = async (): Promise<R> => {
    try {
      return await run()
    } catch (e) {
      // A network failure can throw rather than come back as an error. Shape
      // it like one so every caller handles both the same way.
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } } as unknown as R
    }
  }

  const first = await attempt()
  if (!first.error) return first

  await new Promise(resolve => setTimeout(resolve, 300))
  const second = await attempt()
  if (second.error) {
    console.error(`Database read failed twice (${label}):`, second.error)
    // Every retried read in the codebase ends here when it gives up, and the
    // label already says which one, so this single line covers the lot. The
    // PostgREST code and hint are the diagnostic value and were being thrown
    // away with the console line.
    const err = second.error as { message?: string; code?: string; hint?: string; details?: string }
    Sentry.captureException(new Error(`Database read failed twice: ${label}`), {
      tags: { db_label: label, db_code: err.code ?? 'none' },
      contexts: {
        supabase: {
          message: err.message ?? String(second.error),
          code: err.code ?? null,
          hint: err.hint ?? null,
          details: err.details ?? null,
        },
      },
    })
  } else {
    console.warn(`Database read failed once and recovered on retry (${label}):`, first.error)
  }
  return second
}

const PAGE_SIZE = 500

// Reads every row a query matches, a page at a time.
//
// The database caps how many rows one request will return, and says nothing
// when it hits that cap: the response simply stops early. An unbounded select
// therefore looks like it worked while quietly leaving people out, which for a
// backup is the worst possible failure. It reports a complete-looking file
// that is missing everybody past the cap.
//
// So the reading is paged until a short page comes back, and a failure is
// returned rather than a partial list, because half a members list presented
// as the whole one is more dangerous than no list at all.
export async function readAllRows<T>(
  label: string,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await readWithRetry(label, () => page(from, from + PAGE_SIZE - 1))
    if (error) return { data: [], error }
    const rows = data || []
    for (const row of rows) all.push(row)
    if (rows.length < PAGE_SIZE) return { data: all, error: null }
    // Nothing BILD exports is anywhere near this size. Reaching it means the
    // paging is not terminating, and looping forever inside a scheduled job
    // is worse than stopping with what we have.
    if (all.length >= 100_000) {
      console.error(`Stopped paging at ${all.length} rows (${label}); this should not happen.`)
      return { data: all, error: null }
    }
  }
}
