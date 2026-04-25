/**
 * Bloom filter for efficient set-membership testing during sync.
 *
 * When two devices meet, each builds a Bloom filter from its local message IDs
 * and sends the serialized filter (~1 KB) to the other. The peer checks each of
 * its own IDs against the received filter to find which messages the sender
 * is probably missing. False positives (~1%) are tolerable — they just mean
 * a message isn't sent this round and will be caught on the next sync.
 */

import { sha256 } from '../lib/crypto'

export class BloomFilter {
  private bits: Uint8Array
  private readonly size: number
  private readonly hashes: number

  constructor(size = 8192, hashes = 4) {
    this.size = size
    this.hashes = hashes
    this.bits = new Uint8Array(Math.ceil(size / 8))
  }

  /**
   * Compute `hashes` bit indices for a given key.
   * Uses SHA-256 and splits the hash into 4 x 32-bit integers.
   */
  private async indices(key: string): Promise<number[]> {
    const data = new TextEncoder().encode(key)
    const hash = await sha256(data)
    const idx: number[] = []
    for (let i = 0; i < this.hashes; i++) {
      // Read 4 bytes as a 32-bit unsigned integer
      const v =
        (hash[i * 4] << 24) |
        (hash[i * 4 + 1] << 16) |
        (hash[i * 4 + 2] << 8) |
        hash[i * 4 + 3]
      idx.push(Math.abs(v) % this.size)
    }
    return idx
  }

  /** Add a key (message ID) to the filter. */
  async add(key: string): Promise<void> {
    for (const i of await this.indices(key)) {
      this.bits[i >> 3] |= 1 << (i & 7)
    }
  }

  /** Check if a key is probably in the filter. False positives are possible. */
  async has(key: string): Promise<boolean> {
    for (const i of await this.indices(key)) {
      if (!(this.bits[i >> 3] & (1 << (i & 7)))) return false
    }
    return true
  }

  /** Serialize the filter to raw bytes for transmission. */
  serialize(): Uint8Array {
    return this.bits
  }

  /** Reconstruct a filter from serialized bytes. */
  static deserialize(bytes: Uint8Array): BloomFilter {
    const bf = new BloomFilter(bytes.length * 8, 4)
    bf.bits = bytes
    return bf
  }

  /**
   * Build a filter from an array of message IDs.
   *
   * @example
   * const ids = await getAllMessageIds()
   * const filter = await BloomFilter.fromIds(ids)
   * const bytes = filter.serialize() // ~1 KB, send to peer
   */
  static async fromIds(ids: string[]): Promise<BloomFilter> {
    const bf = new BloomFilter()
    for (const id of ids) {
      await bf.add(id)
    }
    return bf
  }
}
