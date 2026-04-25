/**
 * HopStamp creation and verification.
 *
 * Every time a device relays a message, it appends a HopStamp — a signed
 * record proving "I handled this message at this time." The signature covers
 * (messageId + previousHopSignature + receivedAt), creating a chain where
 * each hop depends on the one before it. Nobody can insert fake hops
 * after the fact.
 */

import type { HopStamp } from '../types'
import { sign, verify } from '../lib/crypto'

/**
 * Build the payload string that gets signed for a hop stamp.
 * Format: messageId + prevHopSig + receivedAt
 */
function buildPayload(
  messageId: string,
  prevHopSig: string | null,
  receivedAt: number,
): string {
  return messageId + (prevHopSig ?? '') + receivedAt
}

/**
 * Create a new HopStamp for a message we're relaying.
 *
 * @param messageId       - The message's content-addressed ID.
 * @param prevHopSig      - Signature from the previous hop (null if we're the first relay).
 * @param receivedAt      - When we received this message (ms since epoch).
 * @param relayerPubkey   - Our public key.
 * @param relayerAlias    - Our current daily alias.
 * @param relayerPrivateKey - Our private key (used to sign the stamp).
 * @returns A fully signed HopStamp.
 *
 * @example
 * const stamp = await createHopStamp(msg.id, lastHopSig, Date.now(), me.publicKey, myAlias, me.privateKey)
 * msg.hops.push(stamp)
 */
export async function createHopStamp(
  messageId: string,
  prevHopSig: string | null,
  receivedAt: number,
  relayerPubkey: string,
  relayerAlias: string,
  relayerPrivateKey: string,
): Promise<HopStamp> {
  const payload = buildPayload(messageId, prevHopSig, receivedAt)
  const payloadBytes = new TextEncoder().encode(payload)
  const signature = await sign(payloadBytes, relayerPrivateKey)

  return {
    relayerPubkey,
    relayerAlias,
    receivedAt,
    signature,
  }
}

/**
 * Verify that a HopStamp's signature is valid.
 *
 * @param stamp      - The hop stamp to verify.
 * @param messageId  - The message's content-addressed ID.
 * @param prevHopSig - Signature from the previous hop (null for the first hop).
 * @returns true if the signature is valid.
 *
 * @example
 * const ok = await verifyHopStamp(hop, msg.id, prevSig)
 */
export async function verifyHopStamp(
  stamp: HopStamp,
  messageId: string,
  prevHopSig: string | null,
): Promise<boolean> {
  const payload = buildPayload(messageId, prevHopSig, stamp.receivedAt)
  const payloadBytes = new TextEncoder().encode(payload)
  return verify(stamp.signature, payloadBytes, stamp.relayerPubkey)
}
