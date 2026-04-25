/**
 * Gzip compression utilities.
 *
 * Uses the native CompressionStream/DecompressionStream APIs (available
 * in all modern browsers). Falls back to pako if the native APIs are
 * not available (e.g. older Safari).
 */

import pako from 'pako'

/** Convert Uint8Array to base64 string. */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

/** Convert base64 string to Uint8Array. */
export function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const hasNativeStreams =
  typeof CompressionStream !== 'undefined' &&
  typeof DecompressionStream !== 'undefined'

/** Gzip-compress a string to bytes. */
export async function gzipString(s: string): Promise<Uint8Array> {
  const input = new TextEncoder().encode(s)

  if (hasNativeStreams) {
    const cs = new CompressionStream('gzip')
    const writer = cs.writable.getWriter()
    writer.write(input)
    writer.close()

    const chunks: Uint8Array[] = []
    const reader = cs.readable.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const result = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) {
      result.set(c, offset)
      offset += c.length
    }
    return result
  }

  // Fallback to pako
  return pako.gzip(input)
}

/** Decompress gzipped bytes back to a string. */
export async function gunzipString(bytes: Uint8Array): Promise<string> {
  if (hasNativeStreams) {
    const ds = new DecompressionStream('gzip')
    const writer = ds.writable.getWriter()
    writer.write(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) as unknown as BufferSource)
    writer.close()

    const chunks: Uint8Array[] = []
    const reader = ds.readable.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const result = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) {
      result.set(c, offset)
      offset += c.length
    }
    return new TextDecoder().decode(result)
  }

  // Fallback to pako
  return new TextDecoder().decode(pako.ungzip(bytes))
}
