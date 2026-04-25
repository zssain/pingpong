/**
 * Canonical serialization for messages.
 *
 * Why does this exist? Signatures must be reproducible across devices.
 * If device A signs a message and device B verifies it, both must produce
 * the exact same bytes from the same message data. JavaScript objects don't
 * have guaranteed key order, so we sort keys alphabetically and emit compact
 * JSON with no whitespace. This gives us deterministic, byte-identical output
 * on every device.
 *
 * The `signature`, `hops`, and `hidden` fields are excluded from the canonical
 * form because:
 * - `signature` is computed *over* the canonical form (circular if included)
 * - `hops` change as the message travels through the mesh
 * - `hidden` is local UI state, not part of the message's identity
 */

import type { Message } from '../types'
import { sha256, bytesToHex } from './crypto'

/**
 * Produce the canonical byte representation of a message.
 *
 * Strips `signature`, `hops`, and `hidden`, sorts remaining keys alphabetically,
 * emits compact JSON, and returns UTF-8 encoded bytes.
 *
 * Two devices that have the same message data will always get the same bytes
 * from this function — that's the whole point.
 *
 * @param msg - The message to canonicalize.
 * @returns UTF-8 encoded bytes of the sorted, compact JSON.
 *
 * @example
 * const bytes = canonicalize(msg)
 * const sig = await signMessage(bytes, privateKey)
 */
export function canonicalize(msg: Message): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { signature, hops, hidden, ...rest } = msg

  // Sort keys alphabetically for deterministic output
  const sorted: Record<string, unknown> = {}
  for (const k of Object.keys(rest).sort()) {
    const value = (rest as Record<string, unknown>)[k]
    // Skip undefined values — they shouldn't appear in the canonical form
    if (value !== undefined) {
      sorted[k] = value
    }
  }

  return new TextEncoder().encode(JSON.stringify(sorted))
}

/**
 * Compute the content-addressed ID for a message.
 *
 * This is the SHA-256 hash of the canonical form, hex-encoded and truncated
 * to 32 characters (128 bits). Two messages with identical content produce
 * the same ID, so duplicates are automatically detected and deduplicated
 * across the mesh.
 *
 * Note: the `replaces` field IS included in the canonical form, so a
 * replacement message has a different ID from the original — they are
 * distinct messages that the system knows are related.
 *
 * @param msg - The message to compute an ID for.
 * @returns A 32-character hex string.
 *
 * @example
 * msg.id = await computeMessageId(msg)
 */
export async function computeMessageId(msg: Message): Promise<string> {
  const bytes = canonicalize(msg)
  const hash = await sha256(bytes)
  return bytesToHex(hash).slice(0, 32)
}

// ---------------------------------------------------------------------------
// Dev-mode self-test: verify that canonicalize is deterministic
// ---------------------------------------------------------------------------
if (import.meta.env.DEV) {
  const testMsg: Message = {
    id: 'test',
    type: 'news',
    content: 'Water trucks arriving at Market Square at 14:00',
    authorPubkey: 'abc123',
    authorAlias: 'amber-wolf-17',
    timestamp: 1713960000000,
    ttl: 1713981600000,
    priority: 0,
    signature: 'should-be-stripped',
    hops: [
      {
        relayerPubkey: 'relay1',
        relayerAlias: 'silver-fox-42',
        receivedAt: 1713960001000,
        signature: 'hopsig1',
      },
    ],
    hidden: true,
  }

  const a = canonicalize(testMsg)
  const b = canonicalize(testMsg)

  const aStr = new TextDecoder().decode(a)
  const bStr = new TextDecoder().decode(b)

  if (aStr === bStr) {
    console.log('[canonical] self-test passed — deterministic serialization confirmed')
  } else {
    console.error('[canonical] SELF-TEST FAILED — non-deterministic output!', aStr, bStr)
  }

  // Also verify that signature, hops, and hidden were stripped
  if (!aStr.includes('"signature"') && !aStr.includes('"hops"') && !aStr.includes('"hidden"')) {
    console.log('[canonical] self-test passed — signature/hops/hidden correctly stripped')
  } else {
    console.error('[canonical] SELF-TEST FAILED — excluded fields found in output!', aStr)
  }
}
