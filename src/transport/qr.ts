/**
 * QR code encoding/decoding utilities.
 */

import QRCode from 'qrcode'
import { sha256, bytesToHex } from '../lib/crypto'

/**
 * Encode text into a QR code data URL (PNG image).
 */
export async function encodeToQR(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'L',
    margin: 1,
    width: 400,
  })
}

async function shortHash(text: string): Promise<string> {
  const hash = await sha256(new TextEncoder().encode(text))
  return bytesToHex(hash).slice(0, 8)
}

/** A single frame in an animated QR sequence. */
export interface QRFrame {
  v: 1
  seq: number
  tot: number
  pid: string
  chk: string
}

/**
 * Max characters that fit reliably in a single QR code
 * with error correction L on a phone camera.
 */
const SINGLE_QR_LIMIT = 2200

/**
 * Split a long payload into QR-sized chunks for animated display.
 * If the payload fits in a single QR, returns it as one frame
 * WITHOUT the animated wrapper — just the raw text.
 */
export async function chunkForAnimatedQR(
  text: string,
  chunkSize = 1800,
): Promise<string[]> {
  // If it fits in one QR, return as-is (no JSON wrapper overhead)
  if (text.length <= SINGLE_QR_LIMIT) {
    return [text]
  }

  const pid = await shortHash(text)
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }
  return chunks.map((chk, i) =>
    JSON.stringify({ v: 1, seq: i, tot: chunks.length, pid, chk } as QRFrame),
  )
}

/**
 * Reassemble frames collected from an animated QR sequence.
 */
export function reassembleAnimatedQR(frames: QRFrame[]): string | null {
  if (frames.length === 0) return null
  const tot = frames[0].tot
  if (frames.length < tot) return null
  const sorted = [...frames].sort((a, b) => a.seq - b.seq)
  for (let i = 0; i < tot; i++) {
    if (!sorted.find((f) => f.seq === i)) return null
  }
  return sorted.map((f) => f.chk).join('')
}
