/**
 * QR code encoding/decoding utilities.
 *
 * Handles both single QR codes (for short payloads like SDP < 2KB)
 * and animated multi-frame QR sequences (for larger payloads).
 */

import QRCode from 'qrcode'
import { sha256, bytesToHex } from '../lib/crypto'

/**
 * Encode text into a QR code data URL (PNG image).
 *
 * @param text - The text to encode.
 * @returns A data:image/png;base64 URL you can use as an img src.
 */
export async function encodeToQR(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'L',
    margin: 1,
    width: 400,
  })
}

/**
 * Short hash of a payload — used as a payload ID so the receiver
 * knows which frames belong together.
 */
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
 * Split a long payload into QR-sized chunks for animated display.
 *
 * Each chunk is a JSON object with sequence metadata so the scanner
 * can reassemble them in order, even if frames arrive out of order
 * or with duplicates.
 *
 * @param text      - The full payload to split.
 * @param chunkSize - Max bytes per chunk (default 350 for reliable QR scanning).
 * @returns Array of JSON strings, each encodable as a single QR frame.
 */
export async function chunkForAnimatedQR(
  text: string,
  chunkSize = 800,
): Promise<string[]> {
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
 *
 * @param frames - Array of parsed QRFrame objects with matching pid.
 * @returns The full reassembled text, or null if frames are incomplete.
 */
export function reassembleAnimatedQR(frames: QRFrame[]): string | null {
  if (frames.length === 0) return null
  const tot = frames[0].tot
  if (frames.length < tot) return null

  // Sort by sequence number
  const sorted = [...frames].sort((a, b) => a.seq - b.seq)

  // Verify we have all sequences
  for (let i = 0; i < tot; i++) {
    if (!sorted.find((f) => f.seq === i)) return null
  }

  return sorted.map((f) => f.chk).join('')
}
