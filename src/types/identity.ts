/**
 * The device's own cryptographic identity, stored as a singleton in IndexedDB.
 * Generated on first launch and never transmitted — the private key stays local.
 *
 * There is only ever one Identity record per device, keyed by 'self'.
 * If the user triggers a panic wipe, this record is deleted and a fresh
 * keypair is generated — the device becomes a completely new identity
 * with no link to its previous self.
 */
export type Identity = {
  /**
   * Always the string 'self' — acts as a singleton marker in IndexedDB.
   * There is exactly one Identity row, and this key ensures we can
   * always find it with a simple lookup: db.identity.get('self').
   */
  key: 'self'

  /**
   * The Ed25519 private (secret) key, hex-encoded.
   * Used to sign messages and hop stamps. Never leaves the device —
   * it is not included in any sync payload or QR code.
   */
  privateKey: string

  /**
   * The Ed25519 public key, hex-encoded.
   * This is shared with peers and attached to signed messages.
   * Other devices use it to verify your signatures.
   */
  publicKey: string

  /** Timestamp (ms since epoch) when this keypair was generated. */
  createdAt: number
}
