/**
 * Network detection utilities.
 *
 * Helps the app decide which transport tier to offer as primary.
 */

/** Simple online/offline check via navigator.onLine. */
export function detectNetworkState(): 'online' | 'offline' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown'
  return navigator.onLine ? 'online' : 'offline'
}

/**
 * Probe whether WebRTC is viable by trying to gather ICE candidates.
 *
 * Creates a temporary RTCPeerConnection with no ICE servers and waits
 * up to 2 seconds for at least one host candidate. If we get one, the
 * device has a usable network interface (LAN) and WebRTC should work.
 *
 * @returns true if at least one host ICE candidate was found.
 */
export async function probeWebRTCViability(): Promise<boolean> {
  if (typeof RTCPeerConnection === 'undefined') return false

  return new Promise<boolean>((resolve) => {
    let resolved = false
    const pc = new RTCPeerConnection({ iceServers: [] })

    // We need a data channel to trigger ICE gathering
    pc.createDataChannel('probe')

    pc.onicecandidate = (e) => {
      if (resolved) return
      if (e.candidate && e.candidate.candidate.includes('host')) {
        resolved = true
        pc.close()
        resolve(true)
      }
    }

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => {
        if (!resolved) {
          resolved = true
          resolve(false)
        }
      })

    // Timeout after 2 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        pc.close()
        resolve(false)
      }
    }, 2000)
  })
}
