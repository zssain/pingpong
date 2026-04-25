/**
 * Dexie database schema — the single IndexedDB instance for the entire app.
 *
 * Four tables:
 * - `messages`  — every news post, alert, DM, and drop
 * - `peers`     — devices we've synced with
 * - `identity`  — exactly one row: our own Ed25519 keypair (key='self')
 * - `contacts`  — DM contacts with their pubkey and handle
 */

import Dexie, { type Table } from 'dexie'
import type { Message, Peer, Identity } from '../types'

export interface Contact {
  pubkey: string
  handle: string
  alias: string
  addedAt: number
}

class MeshDB extends Dexie {
  messages!: Table<Message, string>
  peers!: Table<Peer, string>
  identity!: Table<Identity, string>
  contacts!: Table<Contact, string>

  constructor() {
    super('MeshDB')
    this.version(1).stores({
      messages:
        'id, type, timestamp, ttl, priority, zone, authorPubkey, replaces, hidden, recipientPub',
      peers: 'pubkey, lastSeen',
      identity: 'key',
      contacts: 'pubkey, handle',
    })
  }
}

/** Singleton database instance — import this everywhere. */
export const db = new MeshDB()
