/**
 * A signed stamp added by each device that relays a message.
 * Every time a message passes through a device, that device appends a HopStamp
 * to prove it handled the message at a specific time. This creates a verifiable
 * chain of custody — you can see exactly which devices carried a message and when,
 * without revealing real-world identities (only pseudonymous aliases).
 */
export type HopStamp = {
  /** The public key of the device that relayed this message. */
  relayerPubkey: string

  /** The daily rotating alias of the relayer (e.g. "amber-wolf-17"). */
  relayerAlias: string

  /** Timestamp (ms since epoch) when this device received the message. */
  receivedAt: number

  /**
   * Ed25519 signature covering (messageId + previous hop's signature + receivedAt).
   * This ensures nobody can insert fake hops into the chain after the fact.
   */
  signature: string
}

/**
 * The core data unit of the mesh network. Every piece of information —
 * a news post, an alert, a direct message, or a community drop — is a Message.
 *
 * Messages are content-addressed: the `id` is a SHA-256 hash of the message's
 * canonical form, so two devices that create identical messages will produce the
 * same ID, and tampering is detectable.
 *
 * Messages expire via TTL and are evicted via priority-weighted LRU when storage
 * is full (500-message cap per device).
 */
export type Message = {
  /**
   * Content hash — a 32-character hex string derived from SHA-256 of the
   * canonical (sorted-keys, compact JSON) form of this message.
   * This is the message's unique identifier across the entire mesh.
   */
  id: string

  /**
   * What kind of message this is:
   * - 'news'  — general community posts (like tweets), can be anonymous
   * - 'alert' — life-safety information (medical, routes), always signed
   * - 'dm'    — encrypted direct message between two specific devices
   * - 'drop'  — content bundled for QR dead-drop posters
   */
  type: 'news' | 'dm' | 'alert' | 'drop'

  /**
   * The message body. For most types this is plaintext.
   * For DMs, this is nacl.box ciphertext (encrypted so only the recipient can read it).
   */
  content: string

  /**
   * The author's Ed25519 public key (hex-encoded).
   * - Required for alerts (so people can trust life-safety info).
   * - Required for DMs (recipient needs to know who sent it).
   * - Optional for news — omit this field to post anonymously.
   *   When omitted, the message cannot be traced back to a specific device.
   */
  authorPubkey?: string

  /**
   * The author's daily rotating alias (e.g. "amber-wolf-17").
   * Only present when authorPubkey is present.
   * Derived from hash(pubkey + dayNumber) — changes every day so you
   * can't track someone across days by their display name.
   */
  authorAlias?: string

  /** When the message was created (milliseconds since Unix epoch). */
  timestamp: number

  /**
   * Absolute expiry time (milliseconds since Unix epoch).
   * After this time, devices will delete the message during their TTL sweep.
   * Calculated as: timestamp + TTL duration for the message type.
   */
  ttl: number

  /**
   * Determines how important this message is for sync and storage:
   * - 0 = news (lowest priority, synced last, evicted first)
   * - 1 = drop (medium priority)
   * - 2 = alert (highest priority, synced first, kept longest)
   *
   * When storage is full, low-priority messages are evicted before high-priority ones.
   */
  priority: 0 | 1 | 2

  /**
   * Free-text landmark location string (e.g. "Central Clinic, Main Road").
   * Required for alerts so people know where the emergency is.
   * Optional for other message types.
   */
  location?: string

  /**
   * Optional 4-character geohash for geographic filtering.
   * Devices can filter sync to only exchange messages in their zone,
   * so a device in the north side doesn't get flooded with south-side news.
   */
  zone?: string

  /**
   * The recipient's public key — only used for DMs.
   * The message content is encrypted with nacl.box using the sender's
   * private key and this public key, so only the recipient can decrypt it.
   */
  recipientPub?: string

  /**
   * Points to the `id` of a previous message that this one replaces.
   * Only honored when both messages share the same authorPubkey —
   * this prevents someone else from "replacing" your message.
   * Anonymous messages cannot be replaced (no pubkey to match).
   */
  replaces?: string

  /**
   * Ed25519 signature of the canonical message content.
   * - Required for alerts (unsigned alerts are silently dropped during sync).
   * - Required for DMs.
   * - Optional for news and drops (omit for anonymous posts).
   */
  signature?: string

  /**
   * Chain of custody — an ordered list of HopStamps, one per device
   * that has relayed this message. The first entry is the device that
   * received it directly from the author; each subsequent entry is the
   * next relay in the chain. Allows anyone to verify the full path
   * a message traveled through the mesh.
   */
  hops: HopStamp[]

  /**
   * When true, this message has been superseded by a newer version
   * (another message with `replaces` pointing to this one's id).
   * Hidden messages are kept briefly for causal consistency during sync,
   * then purged when their TTL expires.
   */
  hidden?: boolean
}

/**
 * Numeric priority levels for message types.
 * Use these instead of magic numbers: PRIORITY.NEWS instead of 0.
 */
export const PRIORITY = {
  NEWS: 0,
  DROP: 1,
  ALERT: 2,
} as const

/**
 * Time-to-live durations in milliseconds for each message type.
 * These determine how long a message survives before automatic deletion.
 *
 * - NEWS:     6 hours  — fast-moving community chatter, keep it fresh
 * - DROP:     24 hours — community bulletin, moderate persistence
 * - ALERT:    48 hours — life-safety info, maximize reach
 * - DM:       72 hours — recipient may be offline for days
 * - REPLACED: 1 hour   — old version kept briefly for sync consistency
 */
export const TTL = {
  NEWS: 6 * 60 * 60 * 1000,
  DROP: 24 * 60 * 60 * 1000,
  ALERT: 48 * 60 * 60 * 1000,
  DM: 72 * 60 * 60 * 1000,
  REPLACED: 1 * 60 * 60 * 1000,
} as const
