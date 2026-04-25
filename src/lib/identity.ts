/**
 * Identity utilities — alias derivation and message signing/verification.
 *
 * This module sits between the raw crypto primitives (crypto.ts) and the
 * rest of the app. It provides the human-facing identity layer: daily
 * rotating pseudonyms derived from the device's public key, and convenient
 * wrappers for signing and verifying message content.
 */

import { sha256, sign, verify } from './crypto'
import { ADJECTIVES, ANIMALS } from './wordlist'

/** Number of milliseconds in one day. */
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Derive a human-readable daily alias from a public key.
 *
 * The alias changes every day (based on UTC day number), so nobody can
 * track a device across days by its display name. The same pubkey on the
 * same day always produces the same alias, so peers see a consistent name
 * within a single day.
 *
 * Format: "{adjective}-{animal}-{number}" e.g. "amber-wolf-17"
 *
 * @param pubkeyHex - The device's public key as a hex string.
 * @param dateMs    - Optional timestamp to derive for (defaults to now).
 *                    Useful for displaying historical aliases.
 * @returns The alias string, e.g. "crimson-hawk-42".
 *
 * @example
 * const alias = await deriveAlias(identity.publicKey)
 * // "amber-wolf-17"
 *
 * // What was my alias yesterday?
 * const yesterday = await deriveAlias(identity.publicKey, Date.now() - 86400000)
 */
export async function deriveAlias(
  pubkeyHex: string,
  dateMs: number = Date.now(),
): Promise<string> {
  const dayNumber = Math.floor(dateMs / MS_PER_DAY)
  const input = new TextEncoder().encode(pubkeyHex + dayNumber)
  const hash = await sha256(input)

  const adjective = ADJECTIVES[hash[0] % 64]
  const animal = ANIMALS[hash[1] % 64]
  const number = hash[2] % 100

  return `${adjective}-${animal}-${number}`
}

/**
 * Sign the canonical bytes of a message with a private key.
 *
 * This is a thin wrapper over `crypto.sign()` — it exists so the rest of
 * the app can import signing from one place (identity.ts) without thinking
 * about the underlying crypto library.
 *
 * @param canonicalBytes - The output of `canonicalize(msg)` — the deterministic
 *                         byte representation of a message, excluding signature/hops.
 * @param privateKeyHex  - The device's private key (hex-encoded).
 * @returns The Ed25519 signature as a hex string.
 *
 * @example
 * const sig = await signMessage(canonicalize(msg), identity.privateKey)
 */
export async function signMessage(
  canonicalBytes: Uint8Array,
  privateKeyHex: string,
): Promise<string> {
  return sign(canonicalBytes, privateKeyHex)
}

/**
 * Verify that a message's signature matches its content and claimed author.
 *
 * Called during sync to validate incoming messages. If this returns false,
 * the message is forged or corrupted and should be dropped.
 *
 * @param signatureHex  - The signature to check (hex string from msg.signature).
 * @param canonicalBytes - The canonical byte form of the message.
 * @param publicKeyHex  - The claimed author's public key (from msg.authorPubkey).
 * @returns `true` if the signature is valid.
 *
 * @example
 * const ok = await verifyMessage(msg.signature!, canonicalize(msg), msg.authorPubkey!)
 */
export async function verifyMessage(
  signatureHex: string,
  canonicalBytes: Uint8Array,
  publicKeyHex: string,
): Promise<boolean> {
  return verify(signatureHex, canonicalBytes, publicKeyHex)
}
