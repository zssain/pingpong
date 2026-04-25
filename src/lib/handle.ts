/**
 * Short handle format for sharing public keys.
 *
 * Format: base32(first 5 bytes of pubkey) + 2-char checksum = "BF7K-QR2N"
 * The checksum is derived from a hash of the full prefix to catch typos.
 */

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function bytesToBase32(bytes: Uint8Array): string {
  let bits = ''
  for (const b of bytes) bits += b.toString(2).padStart(8, '0')
  let result = ''
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0')
    result += BASE32_CHARS[parseInt(chunk, 2)]
  }
  return result
}

function base32ToBytes(b32: string): Uint8Array {
  let bits = ''
  for (const c of b32.toUpperCase()) {
    const idx = BASE32_CHARS.indexOf(c)
    if (idx === -1) continue
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  }
  return bytes
}

/** Simple checksum: XOR all bytes, encode as 2 base32 chars. */
function checksum(bytes: Uint8Array): string {
  let xor = 0
  for (const b of bytes) xor ^= b
  return BASE32_CHARS[xor >> 3] + BASE32_CHARS[xor & 0x1f]
}

/**
 * Convert a hex pubkey to a short handle like "BF7K-QR2N".
 */
export function pubkeyToHandle(pubkeyHex: string): string {
  const bytes = new Uint8Array(5)
  for (let i = 0; i < 5; i++) {
    bytes[i] = parseInt(pubkeyHex.slice(i * 2, i * 2 + 2), 16)
  }
  const b32 = bytesToBase32(bytes) // 8 chars
  const chk = checksum(bytes)
  return b32.slice(0, 4) + '-' + b32.slice(4, 8) + chk
}

/**
 * Extract the 5-byte prefix from a handle string.
 * Returns hex string of the prefix (used to search peers table).
 */
export function handleToPubkeyPrefix(handle: string): string {
  const clean = handle.replace(/-/g, '').toUpperCase()
  const b32Part = clean.slice(0, 8) // first 8 base32 chars
  const bytes = base32ToBytes(b32Part)
  let hex = ''
  for (const b of bytes.slice(0, 5)) {
    hex += b.toString(16).padStart(2, '0')
  }
  return hex
}
