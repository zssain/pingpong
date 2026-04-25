/**
 * Encrypted DMs using nacl.box (X25519 + XSalsa20-Poly1305).
 *
 * Our identity keys are Ed25519, but nacl.box needs X25519 (Curve25519).
 * We use ed2curve to convert between the two formats.
 */

import nacl from 'tweetnacl'
import naclUtil from 'tweetnacl-util'
import ed2curve from 'ed2curve'
import { hexToBytes, bytesToHex } from './crypto'

/**
 * Convert a 32-byte Ed25519 public key (hex) to an X25519 public key.
 */
function edPubToX25519(edPubHex: string): Uint8Array {
  // ed2curve expects a 32-byte Uint8Array
  const edPub = hexToBytes(edPubHex)
  const curvePub = ed2curve.convertPublicKey(edPub)
  if (!curvePub) throw new Error('Failed to convert Ed25519 public key to X25519')
  return curvePub
}

/**
 * Convert a 32-byte Ed25519 private key (hex) to an X25519 secret key.
 * Note: nacl sign keys are 64 bytes (privkey + pubkey concatenated),
 * but our stored privateKey is the raw 32-byte seed.
 * ed2curve.convertSecretKey expects a 64-byte nacl sign secret key,
 * so we need to expand it first using nacl.sign.keyPair.fromSeed.
 */
function edPrivToX25519(edPrivHex: string): Uint8Array {
  const seed = hexToBytes(edPrivHex)
  // Expand 32-byte seed to 64-byte nacl sign secret key
  const keyPair = nacl.sign.keyPair.fromSeed(seed)
  return ed2curve.convertSecretKey(keyPair.secretKey)
}

/**
 * Encrypt a plaintext message for a specific recipient.
 *
 * @param plaintext       - The message text to encrypt.
 * @param recipientPubHex - Recipient's Ed25519 public key (hex).
 * @param senderPrivHex   - Sender's Ed25519 private key (hex, 32-byte seed).
 * @returns ciphertext and nonce as hex strings.
 */
export function encryptForRecipient(
  plaintext: string,
  recipientPubHex: string,
  senderPrivHex: string,
): { ciphertext: string; nonce: string } {
  const message = naclUtil.decodeUTF8(plaintext)
  const nonce = nacl.randomBytes(nacl.box.nonceLength)

  const recipientX25519 = edPubToX25519(recipientPubHex)
  const senderX25519 = edPrivToX25519(senderPrivHex)

  const encrypted = nacl.box(message, nonce, recipientX25519, senderX25519)
  if (!encrypted) throw new Error('Encryption failed')

  return {
    ciphertext: bytesToHex(encrypted),
    nonce: bytesToHex(nonce),
  }
}

/**
 * Decrypt a message from a sender.
 *
 * @param ciphertextHex - The ciphertext (hex).
 * @param nonceHex      - The nonce used for encryption (hex).
 * @param senderPubHex  - Sender's Ed25519 public key (hex).
 * @param myPrivHex     - Our Ed25519 private key (hex, 32-byte seed).
 * @returns The decrypted plaintext, or null if decryption fails.
 */
export function decryptFromSender(
  ciphertextHex: string,
  nonceHex: string,
  senderPubHex: string,
  myPrivHex: string,
): string | null {
  try {
    const ciphertext = hexToBytes(ciphertextHex)
    const nonce = hexToBytes(nonceHex)
    const senderX25519 = edPubToX25519(senderPubHex)
    const myX25519 = edPrivToX25519(myPrivHex)

    const decrypted = nacl.box.open(ciphertext, nonce, senderX25519, myX25519)
    if (!decrypted) return null

    return naclUtil.encodeUTF8(decrypted)
  } catch {
    return null
  }
}
