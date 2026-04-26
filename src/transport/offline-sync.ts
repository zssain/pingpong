/**
 * Tier 2: Direct QR sync — works with zero network.
 *
 * One device displays its messages as an animated QR sequence.
 * The other device scans all frames, reassembles, decompresses,
 * and ingests the messages. Then they swap roles for bidirectional sync.
 *
 * The payload is: JSON array of messages → gzip → base64.
 */

import type { Message, Identity } from '../types'
import { getVisibleMessages } from '../db'
import { ingestReceivedMessage } from '../sync/protocol'
import { gzipString, gunzipString, uint8ToBase64, base64ToUint8 } from '../lib/compress'

/**
 * Build a compressed, base64-encoded payload of recent messages.
 *
 * @param maxMessages - Max messages to include (default 50).
 * @returns Base64 string ready for QR chunking.
 */
export async function buildOfflinePayload(maxMessages = 10): Promise<string> {
  const messages = await getVisibleMessages()
  const batch = messages.slice(0, maxMessages)
  const json = JSON.stringify(batch)
  const compressed = await gzipString(json)
  return uint8ToBase64(compressed)
}

/**
 * Decompress and parse a base64 offline payload back into messages.
 * Does NOT verify or ingest — just returns the raw parsed array.
 */
export async function parseOfflinePayload(b64: string): Promise<Message[]> {
  const compressed = base64ToUint8(b64)
  const json = await gunzipString(compressed)
  return JSON.parse(json) as Message[]
}

/**
 * Parse, verify, and ingest all messages from an offline payload.
 *
 * @returns Counts of accepted and rejected messages.
 */
export async function ingestOfflinePayload(
  b64: string,
  myIdentity: Identity,
  myAlias: string,
): Promise<{ accepted: number; rejected: number }> {
  const messages = await parseOfflinePayload(b64)
  let accepted = 0
  let rejected = 0

  for (const msg of messages) {
    const result = await ingestReceivedMessage(msg, myIdentity, myAlias)
    if (result.accepted) {
      accepted++
    } else {
      console.warn('[offline-ingest] Rejected:', result.reason, msg.type, msg.id?.slice(0, 8))
      rejected++
    }
  }

  return { accepted, rejected }
}
