/**
 * WebRTC peer wrapper using simple-peer.
 *
 * Handles the offer/answer handshake and exposes a simple send/receive API
 * for the sync protocol. Configured with trickle=false and no ICE servers —
 * we only need host candidates since both devices are on the same LAN.
 */

import SimplePeer from 'simple-peer'

export class MeshPeer {
  private peer: SimplePeer.Instance
  private signalPromise: Promise<string>
  private signalResolve!: (payload: string) => void

  constructor(opts: { initiator: boolean }) {
    this.peer = new SimplePeer({
      initiator: opts.initiator,
      trickle: false,
      // No ICE servers — on a local LAN, host candidates suffice.
      // This also means the complete SDP is produced in one shot,
      // which is critical for fitting it into a QR code.
      config: { iceServers: [] },
    })

    this.signalPromise = new Promise<string>((resolve) => {
      this.signalResolve = resolve
    })

    this.peer.on('signal', (data) => {
      this.signalResolve(JSON.stringify(data))
    })
  }

  /**
   * Wait for the local SDP signal data (offer or answer).
   * Returns JSON string ready to encode as QR.
   */
  getSignalPayload(): Promise<string> {
    return this.signalPromise
  }

  /**
   * Feed the remote peer's SDP signal data (scanned from QR).
   */
  acceptPeerSignal(payload: string): void {
    this.peer.signal(JSON.parse(payload))
  }

  /** Register a callback for when the data channel opens. */
  onConnect(cb: () => void): void {
    this.peer.on('connect', cb)
  }

  /** Register a callback for incoming data. */
  onData(cb: (data: Uint8Array) => void): void {
    this.peer.on('data', cb)
  }

  /** Register a callback for errors. */
  onError(cb: (err: Error) => void): void {
    this.peer.on('error', cb)
  }

  /** Register a callback for when the connection closes. */
  onClose(cb: () => void): void {
    this.peer.on('close', cb)
  }

  /** Send data over the data channel. */
  send(data: Uint8Array | string): void {
    this.peer.send(data)
  }

  /** Tear down the connection. */
  destroy(): void {
    this.peer.destroy()
  }
}
