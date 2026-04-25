/**
 * Low-level cryptographic primitives for Offline Mesh.
 *
 * This module wraps @noble/ed25519 (signing) and @noble/hashes (SHA-256/SHA-512).
 * Everything in the app that touches keys, signatures, or hashes goes through here
 * so we have a single place to audit.
 *
 * All keys and signatures are passed around as hex-encoded strings for easy
 * storage in IndexedDB and JSON serialization.
 */

import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'
import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js'

// @noble/ed25519 v3 doesn't bundle SHA-512 — we must provide it.
// Without this line, sign() and verify() will throw at runtime.
ed.hashes.sha512 = sha512

/**
 * Generate a fresh Ed25519 keypair.
 *
 * Called once on first launch to create the device's identity.
 * The private key never leaves the device; the public key is shared with peers.
 *
 * @returns An object with hex-encoded `privateKey` (32 bytes) and `publicKey` (32 bytes).
 *
 * @example
 * const { privateKey, publicKey } = await generateKeypair()
 */
export async function generateKeypair(): Promise<{
  privateKey: string
  publicKey: string
}> {
  const privateKey = ed.utils.randomSecretKey()
  const publicKey = await ed.getPublicKeyAsync(privateKey)
  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey),
  }
}

/**
 * Sign a message with an Ed25519 private key.
 *
 * Used to sign messages (alerts, DMs) and hop stamps so other devices
 * can verify authenticity.
 *
 * @param message    - The raw bytes to sign (usually the canonical form of a Message).
 * @param privateKeyHex - Your private key as a hex string.
 * @returns The Ed25519 signature as a hex string (64 bytes / 128 hex chars).
 *
 * @example
 * const sig = await sign(canonicalBytes, identity.privateKey)
 */
export async function sign(
  message: Uint8Array,
  privateKeyHex: string,
): Promise<string> {
  const signature = await ed.signAsync(message, hexToBytes(privateKeyHex))
  return bytesToHex(signature)
}

/**
 * Verify an Ed25519 signature against a message and public key.
 *
 * Used during sync to check that incoming messages and hop stamps are legitimate.
 * If this returns false, the message should be silently dropped.
 *
 * @param signatureHex  - The signature to verify (hex string).
 * @param message       - The original bytes that were signed.
 * @param publicKeyHex  - The signer's public key (hex string).
 * @returns `true` if the signature is valid, `false` otherwise.
 *
 * @example
 * const valid = await verify(msg.signature, canonicalBytes, msg.authorPubkey)
 */
export async function verify(
  signatureHex: string,
  message: Uint8Array,
  publicKeyHex: string,
): Promise<boolean> {
  try {
    return await ed.verifyAsync(
      hexToBytes(signatureHex),
      message,
      hexToBytes(publicKeyHex),
    )
  } catch {
    return false
  }
}

/**
 * Compute the SHA-256 hash of arbitrary bytes.
 *
 * Used for message IDs (content addressing) and Bloom filter indices.
 * We use the synchronous @noble/hashes implementation — no Web Crypto needed.
 *
 * @param data - The bytes to hash.
 * @returns The 32-byte SHA-256 digest.
 *
 * @example
 * const hash = await sha256(new TextEncoder().encode('hello'))
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return nobleSha256(data)
}

/**
 * Convert a hex string to a Uint8Array of bytes.
 *
 * @param hex - An even-length hex string (e.g. "a1b2c3").
 * @returns The corresponding byte array.
 *
 * @example
 * const bytes = hexToBytes('deadbeef') // Uint8Array [222, 173, 190, 239]
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Convert a Uint8Array of bytes to a lowercase hex string.
 *
 * @param bytes - The byte array to encode.
 * @returns A lowercase hex string (2 chars per byte).
 *
 * @example
 * bytesToHex(new Uint8Array([222, 173])) // 'dead'
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
