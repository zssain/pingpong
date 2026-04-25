/**
 * Peer tracking — record which devices we've encountered in the mesh.
 */

import { db } from './schema'
import type { Peer } from '../types'

/**
 * Record that we've seen a peer, creating or updating their entry.
 *
 * Called after a successful sync with another device. Updates `lastSeen`
 * to now, and sets `firstSeen` only if this is the first encounter.
 *
 * @param pubkey - The peer's public key (hex string).
 * @param alias  - The peer's current daily alias.
 *
 * @example
 * await upsertPeer(remotePubkey, remoteAlias)
 */
export async function upsertPeer(
  pubkey: string,
  alias: string,
): Promise<void> {
  const now = Date.now()
  const existing = await db.peers.get(pubkey)

  if (existing) {
    await db.peers.update(pubkey, { alias, lastSeen: now })
  } else {
    await db.peers.put({
      pubkey,
      alias,
      lastSeen: now,
      firstSeen: now,
    })
  }
}

/**
 * Get all peers we've ever synced with.
 *
 * Used for the mesh-graph visualization and peer stats.
 *
 * @returns Array of Peer records.
 *
 * @example
 * const peers = await getKnownPeers()
 * console.log(`Seen ${peers.length} devices`)
 */
export async function getKnownPeers(): Promise<Peer[]> {
  return db.peers.toArray()
}
