/**
 * Message CRUD operations against IndexedDB.
 *
 * All message reads and writes go through this module so the replacement
 * logic (hiding superseded messages) is enforced in one place.
 */

import { db } from './schema'
import { TTL } from '../types'
import type { Message } from '../types'

/**
 * Store a message in the database.
 *
 * If the message has a `replaces` field pointing to an existing message
 * with the same `authorPubkey`, the old message is marked `hidden: true`
 * and its TTL is shortened to 1 hour (kept briefly for sync consistency,
 * then purged by the TTL sweeper).
 *
 * @param msg - The message to store. Must have a computed `id`.
 *
 * @example
 * msg.id = await computeMessageId(msg)
 * await addMessage(msg)
 */
export async function addMessage(msg: Message): Promise<void> {
  // Handle message replacement
  if (msg.replaces) {
    const replaced = await db.messages.get(msg.replaces)
    if (
      replaced &&
      replaced.authorPubkey &&
      msg.authorPubkey &&
      replaced.authorPubkey === msg.authorPubkey
    ) {
      await db.messages.update(msg.replaces, {
        hidden: true,
        ttl: Date.now() + TTL.REPLACED,
      })
    }
  }

  await db.messages.put(msg)
}

/**
 * Retrieve a single message by its content-addressed ID.
 *
 * @param id - The 32-char hex message ID.
 * @returns The message, or undefined if not found.
 *
 * @example
 * const msg = await getMessage('a1b2c3d4...')
 */
export async function getMessage(
  id: string,
): Promise<Message | undefined> {
  return db.messages.get(id)
}

/**
 * Get all visible (non-hidden, non-expired) messages, newest first.
 *
 * This is what powers the feed UI. Hidden messages (superseded by a
 * replacement) and expired messages (past their TTL) are excluded.
 *
 * @param type - Optional filter: only return messages of this type
 *               ('news', 'alert', 'dm', 'drop').
 * @returns Messages sorted by timestamp descending (newest first).
 *
 * @example
 * const allVisible = await getVisibleMessages()
 * const alerts = await getVisibleMessages('alert')
 */
export async function getVisibleMessages(
  type?: Message['type'],
): Promise<Message[]> {
  const now = Date.now()

  let collection = db.messages.orderBy('timestamp')

  if (type) {
    collection = db.messages.where('type').equals(type).reverse()
    const results = await collection.toArray()
    return results.filter((m) => !m.hidden && m.ttl > now)
  }

  const results = await collection.reverse().toArray()
  return results.filter((m) => !m.hidden && m.ttl > now)
}

/**
 * Check if a message with this ID already exists locally.
 *
 * Used during sync to skip messages we already have — avoids
 * redundant writes and signature verification.
 *
 * @param id - The 32-char hex message ID.
 * @returns true if the message exists in our database.
 *
 * @example
 * if (await hasMessage(incomingMsg.id)) return // already have it
 */
export async function hasMessage(id: string): Promise<boolean> {
  return (await db.messages.get(id)) !== undefined
}

/**
 * Get all message IDs in the local database.
 *
 * Used to build a Bloom filter for the sync protocol — we send this
 * compact summary to a peer so they can figure out which messages
 * we're missing.
 *
 * @returns Array of 32-char hex message IDs.
 *
 * @example
 * const ids = await getAllMessageIds()
 * for (const id of ids) bloomFilter.add(id)
 */
export async function getAllMessageIds(): Promise<string[]> {
  return db.messages.toCollection().primaryKeys() as Promise<string[]>
}
