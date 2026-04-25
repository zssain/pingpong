/**
 * Identity persistence — create, retrieve, and wipe the device's keypair.
 */

import { db } from './schema'
import { generateKeypair } from '../lib/crypto'
import type { Identity } from '../types'

/**
 * Get the device's identity, creating one on first launch.
 *
 * On first call ever, generates a fresh Ed25519 keypair and stores it
 * in IndexedDB. On subsequent calls, returns the existing keypair.
 * The private key never leaves this device.
 *
 * @returns The device's Identity (privateKey, publicKey, createdAt).
 *
 * @example
 * const identity = await getOrCreateIdentity()
 * console.log(identity.publicKey) // hex string
 */
export async function getOrCreateIdentity(): Promise<Identity> {
  const existing = await db.identity.get('self')
  if (existing) return existing

  const { privateKey, publicKey } = await generateKeypair()
  const identity: Identity = {
    key: 'self',
    privateKey,
    publicKey,
    createdAt: Date.now(),
  }
  await db.identity.put(identity)
  return identity
}

/**
 * Panic wipe — destroy all local data and regenerate a fresh identity.
 *
 * Clears every table (messages, peers, identity), then creates a brand-new
 * keypair. After this call the device is a completely new identity with
 * no link to its previous self. Takes ~2 seconds.
 *
 * @example
 * await wipeIdentity() // device is now "jade-lynx-88" instead of "amber-wolf-17"
 */
export async function wipeIdentity(): Promise<void> {
  await db.messages.clear()
  await db.peers.clear()
  await db.identity.clear()
  await getOrCreateIdentity()
}
