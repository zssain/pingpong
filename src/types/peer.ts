/**
 * Represents another device we've encountered in the mesh.
 * A Peer record is created the first time we sync with a new device
 * and updated on each subsequent encounter. This is used to power
 * the mesh-graph visualization and track network health.
 *
 * Peers are identified by their public key — since aliases rotate daily,
 * the pubkey is the stable identifier across sessions.
 */
export type Peer = {
  /** The peer's Ed25519 public key (hex-encoded). Unique identifier. */
  pubkey: string

  /** The peer's current daily alias (e.g. "silver-fox-42"). Updates each day. */
  alias: string

  /** Timestamp (ms since epoch) of the last time we synced with this peer. */
  lastSeen: number

  /** Timestamp (ms since epoch) of the first time we ever encountered this peer. */
  firstSeen: number

  /**
   * How many messages we've relayed to or received from this peer across
   * all sync sessions. Optional because it starts at 0 and is only tracked
   * once sync is active.
   */
  messageCount?: number
}
