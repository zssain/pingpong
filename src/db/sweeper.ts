/**
 * TTL sweeper — periodically deletes expired messages.
 *
 * Messages have an absolute `ttl` timestamp. Once `Date.now()` passes
 * that timestamp, the message is expired and should be removed to keep
 * the local database small and reduce seizure risk.
 */

import { db } from './schema'

/**
 * Start a periodic TTL sweep that deletes expired messages.
 *
 * Runs immediately once, then repeats every `intervalMs` milliseconds.
 * Returns a cleanup function that stops the interval — call it in
 * your React useEffect cleanup.
 *
 * @param intervalMs - How often to sweep, in milliseconds (default: 60 seconds).
 * @returns A function that stops the sweeper.
 *
 * @example
 * useEffect(() => {
 *   const stop = startTtlSweeper()
 *   return stop
 * }, [])
 */
export function startTtlSweeper(intervalMs = 60_000): () => void {
  const sweep = async () => {
    const count = await db.messages.where('ttl').below(Date.now()).delete()
    if (count > 0) {
      console.log(`[sweeper] purged ${count} expired message(s)`)
    }
  }

  // Run immediately on start
  sweep()

  const id = setInterval(sweep, intervalMs)
  return () => clearInterval(id)
}
