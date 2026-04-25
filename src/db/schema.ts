/**
 * Dexie database schema — the single IndexedDB instance for the entire app.
 *
 * Three tables:
 * - `messages` — every news post, alert, DM, and drop the device knows about
 * - `peers`    — devices we've synced with (for mesh graph and stats)
 * - `identity` — exactly one row: our own Ed25519 keypair (key='self')
 *
 * Indexes are chosen to support the queries we actually run:
 * TTL sweeps (ttl), feed views (type, timestamp, hidden), sync (id, authorPubkey),
 * replacement lookups (replaces), and zone filtering (zone).
 */

import Dexie, { type Table } from 'dexie'
import type { Message, Peer, Identity } from '../types'

class MeshDB extends Dexie {
  messages!: Table<Message, string>
  peers!: Table<Peer, string>
  identity!: Table<Identity, string>

  constructor() {
    super('MeshDB')
    this.version(1).stores({
      messages:
        'id, type, timestamp, ttl, priority, zone, authorPubkey, replaces, hidden',
      peers: 'pubkey, lastSeen',
      identity: 'key',
    })
  }
}

/** Singleton database instance — import this everywhere. */
export const db = new MeshDB()
