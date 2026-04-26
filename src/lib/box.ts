/**
 * Encrypted DMs using nacl.box (X25519 + XSalsa20-Poly1305).
 *
 * Our identity keys are Ed25519 (32-byte seed stored as hex).
 * nacl.box needs X25519 keys. We convert using tweetnacl's own
 * sign keypair expansion + ed2curve for the Montgomery transform.
 */

import nacl from 'tweetnacl'
import naclUtil from 'tweetnacl-util'
import ed2curve from 'ed2curve'
import { hexToBytes, bytesToHex } from './crypto'

/**
 * Convert Ed25519 public key (hex) to X25519 public key.
 */
function edPubToX25519(edPubHex: string): Uint8Array {
  const edPub = hexToBytes(edPubHex)
  const curvePub = ed2curve.convertPublicKey(edPub)
  if (!curvePub) throw new Error('Failed to convert public key')
  return curvePub
}

/**
 * Convert Ed25519 32-byte seed (hex) to X25519 secret key.
 *
 * Steps:
 * 1. Expand seed → 64-byte nacl sign secret key via fromSeed
 * 2. ed2curve.convertSecretKey on the 64-byte key
 */
function edSeedToX25519Secret(seedHex: string): Uint8Array {
  const seed = hexToBytes(seedHex)
  const signKP = nacl.sign.keyPair.fromSeed(seed)
  return ed2curve.convertSecretKey(signKP.secretKey)
}

/**
 * Encrypt a message for a recipient.
 */
export function encryptForRecipient(
  plaintext: string,
  recipientPubHex: string,
  senderPrivHex: string,
): { ciphertext: string; nonce: string } {
  const message = naclUtil.decodeUTF8(plaintext)
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const recipientX = edPubToX25519(recipientPubHex)
  const senderX = edSeedToX25519Secret(senderPrivHex)

  // Verify the sender's nacl-derived pubkey matches what we stored
  const senderSignKP = nacl.sign.keyPair.fromSeed(hexToBytes(senderPrivHex))
  console.log('[box] encrypt — nacl pubkey:', bytesToHex(senderSignKP.publicKey).slice(0, 16) + '...')

  const encrypted = nacl.box(message, nonce, recipientX, senderX)
  if (!encrypted) throw new Error('Encryption failed')

  return {
    ciphertext: bytesToHex(encrypted),
    nonce: bytesToHex(nonce),
  }
}

/**
 * Decrypt a message. otherPubHex is the OTHER party's Ed25519 pubkey.
 */
export function decryptFromSender(
  ciphertextHex: string,
  nonceHex: string,
  otherPubHex: string,
  myPrivHex: string,
): string | null {
  try {
    const ciphertext = hexToBytes(ciphertextHex)
    const nonce = hexToBytes(nonceHex)
    const otherX = edPubToX25519(otherPubHex)
    const myX = edSeedToX25519Secret(myPrivHex)

    const decrypted = nacl.box.open(ciphertext, nonce, otherX, myX)
    if (!decrypted) {
      console.warn('[box] box.open returned null — key mismatch or corrupted')
      return null
    }

    return naclUtil.encodeUTF8(decrypted)
  } catch (e) {
    console.error('[box] Decryption error:', e)
    return null
  }
}
