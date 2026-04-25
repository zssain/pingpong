import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Wifi, WifiOff, CheckCircle, Loader2, AlertCircle,
  QrCode, Share2, Camera, ChevronDown,
} from 'lucide-react'
import { MeshPeer } from '../transport/rtc'
import { chunkForAnimatedQR } from '../transport/qr'
import { QRDisplay } from '../components/QRDisplay'
import { QRScanner } from '../components/QRScanner'
import { SyncProgress } from '../components/SyncProgress'
import { SyncActivityLog } from '../components/SyncActivityLog'
import {
  buildLocalFingerprint,
  computeMissingIds,
  packMessagesForSend,
  ingestReceivedMessage,
} from '../sync/protocol'
import {
  buildOfflinePayload,
  ingestOfflinePayload,
} from '../transport/offline-sync'
import { detectNetworkState, probeWebRTCViability } from '../lib/networkDetect'
import { getOrCreateIdentity } from '../db'
import { getKnownPeers } from '../db/peers'
import { deriveAlias } from '../lib/identity'
import { useSyncStore } from '../store/sync'
import { useUiStore } from '../store/ui'
import { useGraphStore } from '../store/graph'

// ─── Sync envelope types ─────────────────────────────────────────────
interface FpEnvelope { t: 'fp'; data: string }
interface MsgEnvelope { t: 'msg'; data: string }
interface DoneEnvelope { t: 'done'; sent: number; alias: string }
type Envelope = FpEnvelope | MsgEnvelope | DoneEnvelope

// ─── State machine ───────────────────────────────────────────────────
type Step =
  | 'idle'
  | 'show-offer' | 'scan-answer' | 'scan-offer' | 'show-answer'
  | 'connected' | 'syncing'
  | 'offline-choose' | 'offline-share' | 'offline-scan' | 'offline-ingesting'
  | 'done' | 'error'

// ─── Helpers ─────────────────────────────────────────────────────────
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}
function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const QR_SINGLE_LIMIT = 1500
const HANDSHAKE_TIMEOUT_MS = 30_000

export function ConnectScreen() {
  const [step, setStep] = useState<Step>('idle')
  const [status, setStatus] = useState('')
  const [syncPhase, setSyncPhase] = useState<'handshaking' | 'syncing' | 'complete'>('handshaking')
  const [sent, setSent] = useState(0)
  const [received, setReceived] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [offerFrames, setOfferFrames] = useState<string[]>([])
  const [answerFrames, setAnswerFrames] = useState<string[]>([])
  const [peerAlias, setPeerAlias] = useState<string | null>(null)
  const [offlineFrames, setOfflineFrames] = useState<string[]>([])
  const [offlineResult, setOfflineResult] = useState<{ accepted: number; rejected: number } | null>(null)
  const [showTier1, setShowTier1] = useState(false)

  const peerRef = useRef<MeshPeer | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handshakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentDoneRef = useRef(false)

  const appendEvent = useSyncStore((s) => s.appendEvent)
  const recordHop = useGraphStore((s) => s.recordHop)
  const setPeerCount = useUiStore((s) => s.setPeerCount)
  const showToast = useUiStore((s) => s.showToast)
  const networkMode = useUiStore((s) => s.networkMode)
  const setNetworkMode = useUiStore((s) => s.setNetworkMode)
  const noteHandshakeFail = useUiStore((s) => s.noteHandshakeFail)
  const resetHandshakeFail = useUiStore((s) => s.resetHandshakeFail)

  const isLan = networkMode === 'lan'
  const isOffline = networkMode === 'offline'

  // ── Network detection on mount ─────────────────────────────────────
  useEffect(() => {
    async function detect() {
      const netState = detectNetworkState()
      if (netState === 'offline') {
        setNetworkMode('offline')
        return
      }
      const webrtcOk = await probeWebRTCViability()
      setNetworkMode(webrtcOk ? 'lan' : 'offline')
    }
    detect()
  }, [setNetworkMode])

  // Online/offline events
  useEffect(() => {
    const onOnline = () => {
      probeWebRTCViability().then((ok) => setNetworkMode(ok ? 'lan' : 'offline'))
    }
    const onOffline = () => setNetworkMode('offline')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [setNetworkMode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerRef.current?.destroy()
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current)
    }
  }, [])

  const refreshPeerCount = useCallback(async () => {
    const peers = await getKnownPeers()
    setPeerCount(peers.length)
  }, [setPeerCount])

  // ── Handshake timeout helper ───────────────────────────────────────
  const startHandshakeTimer = useCallback(() => {
    if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current)
    handshakeTimerRef.current = setTimeout(() => {
      if (step === 'scan-answer' || step === 'show-answer' || step === 'show-offer' || step === 'scan-offer') {
        noteHandshakeFail()
        peerRef.current?.destroy()
        peerRef.current = null
        setStep('error')
        setErrorMsg('Handshake timed out — no connection after 30s.')
        showToast('Handshake failed. Try offline sync?', 4000)
      }
    }, HANDSHAKE_TIMEOUT_MS)
  }, [step, noteHandshakeFail, showToast])

  const clearHandshakeTimer = useCallback(() => {
    if (handshakeTimerRef.current) {
      clearTimeout(handshakeTimerRef.current)
      handshakeTimerRef.current = null
    }
  }, [])

  // ── Tier 1: Run sync protocol ──────────────────────────────────────
  const runSync = useCallback(async (peer: MeshPeer) => {
    clearHandshakeTimer()
    resetHandshakeFail()
    setStep('syncing')
    setSyncPhase('handshaking')
    setStatus('Exchanging fingerprints...')
    sentDoneRef.current = false
    let sentCount = 0
    let recvCount = 0

    const identity = await getOrCreateIdentity()
    const alias = await deriveAlias(identity.publicKey)

    const fp = await buildLocalFingerprint()
    peer.send(JSON.stringify({ t: 'fp', data: uint8ToBase64(fp) } as FpEnvelope))

    peer.onData(async (raw: Uint8Array) => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      let env: Envelope
      try { env = JSON.parse(new TextDecoder().decode(raw)) as Envelope } catch { return }

      if (env.t === 'fp') {
        setSyncPhase('syncing')
        setStatus('Sending messages...')
        const peerFp = base64ToUint8(env.data)
        const missingIds = await computeMissingIds(peerFp)
        const toSend = await packMessagesForSend(missingIds)
        for (const msg of toSend) {
          peer.send(JSON.stringify({ t: 'msg', data: JSON.stringify(msg) } as MsgEnvelope))
          sentCount++
          setSent(sentCount)
          appendEvent({ t: Date.now(), kind: 'msg-sent', messageId: msg.id })
          recordHop(identity.publicKey, 'peer', msg.id, alias)
        }
        idleTimerRef.current = setTimeout(() => {
          if (!sentDoneRef.current) {
            sentDoneRef.current = true
            peer.send(JSON.stringify({ t: 'done', sent: sentCount, alias } as DoneEnvelope))
            finishSync(sentCount, recvCount, null)
          }
        }, 2000)
      }

      if (env.t === 'msg') {
        setSyncPhase('syncing')
        setStatus('Receiving messages...')
        try {
          const msg = JSON.parse(env.data)
          const result = await ingestReceivedMessage(msg, identity, alias)
          if (result.accepted) {
            recvCount++
            setReceived(recvCount)
            appendEvent({ t: Date.now(), kind: 'msg-received', messageId: msg.id })
            if (msg.authorPubkey) {
              recordHop(msg.authorPubkey, identity.publicKey, msg.id, msg.authorAlias, alias)
            }
          }
        } catch (e) { console.warn('[sync] Ingest error:', e) }
        idleTimerRef.current = setTimeout(() => {
          if (!sentDoneRef.current) {
            sentDoneRef.current = true
            peer.send(JSON.stringify({ t: 'done', sent: sentCount, alias } as DoneEnvelope))
            finishSync(sentCount, recvCount, null)
          }
        }, 2000)
      }

      if (env.t === 'done') {
        const remoteAlias = (env as DoneEnvelope).alias ?? null
        if (remoteAlias) setPeerAlias(remoteAlias)
        if (!sentDoneRef.current) {
          sentDoneRef.current = true
          peer.send(JSON.stringify({ t: 'done', sent: sentCount, alias } as DoneEnvelope))
        }
        finishSync(sentCount, recvCount, remoteAlias)
      }
    })

    peer.onError((err) => {
      appendEvent({ t: Date.now(), kind: 'peer-disconnected', error: err.message })
      setStep('error')
      setErrorMsg(err.message || 'Connection lost')
    })

    peer.onClose(() => { finishSync(sentCount, recvCount, peerAlias) })

    function finishSync(s: number, r: number, remoteAlias: string | null) {
      setSyncPhase('complete')
      setStep('done')
      setStatus(
        remoteAlias
          ? `${remoteAlias} shared ${r} message${r !== 1 ? 's' : ''}. You shared ${s}.`
          : `Sync complete. ${s + r} message${s + r !== 1 ? 's' : ''} exchanged.`,
      )
      appendEvent({ t: Date.now(), kind: 'sync-complete', peerAlias: remoteAlias ?? undefined })
      refreshPeerCount()
      if (r > 0) showToast(`${r} new message${r !== 1 ? 's' : ''} from ${remoteAlias ?? 'peer'}`)
    }
  }, [appendEvent, recordHop, peerAlias, refreshPeerCount, showToast, clearHandshakeTimer, resetHandshakeFail])

  // ── Tier 1: Initiator ──────────────────────────────────────────────
  const startAsInitiator = useCallback(async () => {
    try {
      setStep('show-offer')
      setStatus('Generating offer...')
      setSent(0); setReceived(0)
      const peer = new MeshPeer({ initiator: true })
      peerRef.current = peer
      const offerPayload = await peer.getSignalPayload()
      if (offerPayload.length > QR_SINGLE_LIMIT) {
        setOfferFrames(await chunkForAnimatedQR(offerPayload))
      } else {
        setOfferFrames([offerPayload])
      }
      setStatus('Show this QR to the other device')
      startHandshakeTimer()
    } catch {
      setStep('error'); setErrorMsg('Failed to create offer')
    }
  }, [startHandshakeTimer])

  const onAnswerScanned = useCallback((payload: string) => {
    const peer = peerRef.current
    if (!peer) return
    try { peer.acceptPeerSignal(payload) } catch {
      setStep('error'); setErrorMsg('Invalid answer QR'); return
    }
    setStatus('Connecting...')
    appendEvent({ t: Date.now(), kind: 'peer-connected' })
    peer.onConnect(() => {
      clearHandshakeTimer()
      setStep('connected')
      setStatus('Connected! Running sync...')
      refreshPeerCount()
      runSync(peer)
    })
  }, [runSync, appendEvent, refreshPeerCount, clearHandshakeTimer])

  const startAsResponder = useCallback(() => {
    setStep('scan-offer')
    setStatus('Point camera at the offer QR')
    setSent(0); setReceived(0)
    startHandshakeTimer()
  }, [startHandshakeTimer])

  const onOfferScanned = useCallback(async (payload: string) => {
    try {
      setStep('show-answer')
      setStatus('Generating answer...')
      const peer = new MeshPeer({ initiator: false })
      peerRef.current = peer
      peer.acceptPeerSignal(payload)
      const answerPayload = await peer.getSignalPayload()
      if (answerPayload.length > QR_SINGLE_LIMIT) {
        setAnswerFrames(await chunkForAnimatedQR(answerPayload))
      } else {
        setAnswerFrames([answerPayload])
      }
      setStatus('Show this QR to the other device')
      appendEvent({ t: Date.now(), kind: 'peer-connected' })
      peer.onConnect(() => {
        clearHandshakeTimer()
        setStep('connected')
        setStatus('Connected! Running sync...')
        refreshPeerCount()
        runSync(peer)
      })
      peer.onError((err) => {
        appendEvent({ t: Date.now(), kind: 'peer-disconnected', error: err.message })
        setStep('error'); setErrorMsg(err.message || 'Connection failed')
      })
    } catch {
      setStep('error'); setErrorMsg('Invalid offer QR')
    }
  }, [runSync, appendEvent, refreshPeerCount, clearHandshakeTimer])

  // ── Tier 2: Offline ────────────────────────────────────────────────
  const startOfflineShare = useCallback(async () => {
    try {
      setStep('offline-share')
      setStatus('Preparing messages...')
      const b64 = await buildOfflinePayload()
      const frames = await chunkForAnimatedQR(b64)
      setOfflineFrames(frames)
      setStatus(`Sharing ${frames.length} QR frames — hold steady`)
    } catch { setStep('error'); setErrorMsg('Failed to build payload') }
  }, [])

  const startOfflineScan = useCallback(() => {
    setStep('offline-scan')
    setStatus('Scanning messages...')
    setOfflineResult(null)
  }, [])

  const onOfflinePayloadScanned = useCallback(async (b64: string) => {
    try {
      setStep('offline-ingesting')
      setStatus('Verifying and storing messages...')
      const identity = await getOrCreateIdentity()
      const alias = await deriveAlias(identity.publicKey)
      const result = await ingestOfflinePayload(b64, identity, alias)
      setOfflineResult(result)
      setStep('done')
      setStatus(
        `Accepted ${result.accepted} message${result.accepted !== 1 ? 's' : ''}` +
        (result.rejected > 0 ? `, rejected ${result.rejected}` : '') + '.',
      )
      appendEvent({ t: Date.now(), kind: 'sync-complete' })
      refreshPeerCount()
      if (result.accepted > 0) showToast(`${result.accepted} new message${result.accepted !== 1 ? 's' : ''} via QR sync`)
    } catch { setStep('error'); setErrorMsg('Failed to parse QR payload') }
  }, [appendEvent, refreshPeerCount, showToast])

  // ── Reset ──────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    peerRef.current?.destroy()
    peerRef.current = null
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    clearHandshakeTimer()
    setStep('idle')
    setStatus('')
    setSent(0); setReceived(0)
    setErrorMsg('')
    setOfferFrames([]); setAnswerFrames([])
    setOfflineFrames([]); setOfflineResult(null)
    setPeerAlias(null)
    setShowTier1(false)
    sentDoneRef.current = false
  }, [clearHandshakeTimer])

  // ── Network status indicator ───────────────────────────────────────
  function NetworkBadge() {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
        <span className={`w-2 h-2 rounded-full ${isLan ? 'bg-green-500' : isOffline ? 'bg-amber-500' : 'bg-slate-300'}`} />
        <span>
          {isLan ? 'LAN available' : isOffline ? 'No peers reachable' : 'Detecting network...'}
        </span>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="p-4 flex flex-col items-center">

      {/* ── Idle ── */}
      {step === 'idle' && (
        <div className="w-full max-w-sm space-y-4 animate-fade-in">
          <div className="text-center py-4">
            {isOffline ? (
              <WifiOff size={40} className="mx-auto text-amber-400 mb-3" />
            ) : (
              <Wifi size={40} className="mx-auto text-slate-300 mb-3" />
            )}
            <h2 className="text-lg font-semibold text-slate-900">Connect to peer</h2>
            <p className="text-sm text-slate-500 mt-1">Exchange messages with a nearby device.</p>
          </div>

          <NetworkBadge />

          {/* Primary tier based on network */}
          {isLan || networkMode === 'unknown' ? (
            <>
              {/* Tier 1 primary */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Wi-Fi sync</p>
                <button onClick={startAsInitiator} className="w-full py-3 rounded-lg bg-[#0B3D91] text-white text-sm font-medium active:bg-[#092d6d] transition-colors duration-150">
                  Create offer
                </button>
                <button onClick={startAsResponder} className="w-full py-3 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium active:bg-slate-50 transition-colors duration-150">
                  Scan offer
                </button>
              </div>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Tier 2 secondary */}
              <button
                onClick={() => setStep('offline-choose')}
                className="w-full py-3 rounded-lg border-2 border-dashed border-slate-300 text-slate-700 text-sm font-medium active:bg-slate-50 transition-colors duration-150 flex items-center justify-center gap-2"
              >
                <QrCode size={16} />
                Camera-to-camera QR sync
              </button>
            </>
          ) : (
            <>
              {/* Tier 2 primary (offline) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-lg mb-2">
                  <WifiOff size={14} className="shrink-0" />
                  <span>No Wi-Fi detected. Offline sync works with just a camera.</span>
                </div>
                <button
                  onClick={() => setStep('offline-choose')}
                  className="w-full py-3 rounded-lg bg-slate-900 text-white text-sm font-medium active:bg-slate-800 transition-colors duration-150 flex items-center justify-center gap-2"
                >
                  <QrCode size={16} />
                  Offline sync
                </button>
              </div>

              {/* Tier 1 collapsed */}
              <button
                onClick={() => setShowTier1(!showTier1)}
                className="w-full flex items-center justify-center gap-1 text-xs text-slate-400 py-2"
              >
                <ChevronDown size={14} className={`transition-transform duration-150 ${showTier1 ? 'rotate-180' : ''}`} />
                Advanced: Wi-Fi sync
              </button>
              {showTier1 && (
                <div className="space-y-2 animate-fade-in">
                  <button onClick={startAsInitiator} className="w-full py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium active:bg-slate-50 transition-colors duration-150">
                    Create offer
                  </button>
                  <button onClick={startAsResponder} className="w-full py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium active:bg-slate-50 transition-colors duration-150">
                    Scan offer
                  </button>
                </div>
              )}
            </>
          )}

          <SyncActivityLog />
        </div>
      )}

      {/* ── Offline choose ── */}
      {step === 'offline-choose' && (
        <div className="w-full max-w-sm space-y-4 animate-fade-in">
          <div className="text-center py-4">
            <QrCode size={40} className="mx-auto text-slate-300 mb-3" />
            <h2 className="text-lg font-semibold text-slate-900">Offline sync</h2>
            <p className="text-sm text-slate-500 mt-1">No Wi-Fi needed — just point cameras at each other.</p>
          </div>
          <button onClick={startOfflineShare} className="w-full py-3 rounded-lg bg-slate-900 text-white text-sm font-medium active:bg-slate-800 transition-colors duration-150 flex items-center justify-center gap-2">
            <Share2 size={16} /> Share my messages
          </button>
          <button onClick={startOfflineScan} className="w-full py-3 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium active:bg-slate-50 transition-colors duration-150 flex items-center justify-center gap-2">
            <Camera size={16} /> Scan messages
          </button>
          <button onClick={reset} className="w-full text-xs text-slate-400 underline text-center">Back</button>
        </div>
      )}

      {/* ── Offline share ── */}
      {step === 'offline-share' && (
        <div className="space-y-4 animate-fade-in text-center">
          <h3 className="text-sm font-semibold text-slate-700">Sharing messages</h3>
          {offlineFrames.length > 0 ? <QRDisplay frames={offlineFrames} /> : <Loader2 size={32} className="mx-auto text-slate-400 animate-spin" />}
          <p className="text-xs text-slate-500">{status}</p>
          <p className="text-xs text-slate-400">Other device: tap "Scan messages" and point camera here</p>
          <button onClick={reset} className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium active:bg-slate-800 transition-colors duration-150">Done</button>
        </div>
      )}

      {/* ── Offline scan ── */}
      {step === 'offline-scan' && (
        <div className="space-y-4 animate-fade-in text-center">
          <h3 className="text-sm font-semibold text-slate-700">Scanning messages</h3>
          <QRScanner mode="animated" onComplete={onOfflinePayloadScanned} />
          <p className="text-xs text-slate-500">{status}</p>
          <button onClick={reset} className="text-xs text-slate-400 underline">Cancel</button>
        </div>
      )}

      {step === 'offline-ingesting' && (
        <div className="space-y-4 animate-fade-in text-center py-8">
          <Loader2 size={40} className="mx-auto text-blue-500 animate-spin" />
          <h3 className="text-sm font-semibold text-slate-700">{status}</h3>
        </div>
      )}

      {/* ── Tier 1 QR steps ── */}
      {step === 'show-offer' && (
        <div className="space-y-4 animate-fade-in text-center">
          <h3 className="text-sm font-semibold text-slate-700">Your offer</h3>
          <QRDisplay frames={offerFrames} />
          <p className="text-xs text-slate-500">Other device: tap "Scan offer" and point camera here</p>
          <button onClick={() => { setStep('scan-answer'); startHandshakeTimer() }} className="w-full max-w-xs py-2.5 rounded-lg bg-[#0B3D91] text-white text-sm font-medium active:bg-[#092d6d] transition-colors duration-150">
            Next: Scan their answer
          </button>
          <button onClick={reset} className="text-xs text-slate-400 underline">Cancel</button>
        </div>
      )}

      {step === 'scan-answer' && (
        <div className="space-y-4 animate-fade-in text-center">
          <h3 className="text-sm font-semibold text-slate-700">Scan their answer</h3>
          <QRScanner mode="animated" onComplete={onAnswerScanned} />
          <button onClick={reset} className="text-xs text-slate-400 underline">Cancel</button>
        </div>
      )}

      {step === 'scan-offer' && (
        <div className="space-y-4 animate-fade-in text-center">
          <h3 className="text-sm font-semibold text-slate-700">Scan offer QR</h3>
          <QRScanner mode="animated" onComplete={onOfferScanned} />
          <button onClick={reset} className="text-xs text-slate-400 underline">Cancel</button>
        </div>
      )}

      {step === 'show-answer' && (
        <div className="space-y-4 animate-fade-in text-center">
          <h3 className="text-sm font-semibold text-slate-700">Your answer</h3>
          <QRDisplay frames={answerFrames} />
          <p className="text-xs text-slate-500">Other device: scan this to complete the connection</p>
          <button onClick={reset} className="text-xs text-slate-400 underline">Cancel</button>
        </div>
      )}

      {/* ── Connected / Syncing ── */}
      {(step === 'connected' || step === 'syncing') && (
        <div className="space-y-4 animate-fade-in text-center py-8">
          <Loader2 size={40} className="mx-auto text-blue-500 animate-spin" />
          <SyncProgress phase={syncPhase} received={received} total={sent + received > 0 ? sent + received : undefined} />
          <p className="text-xs text-slate-400">{status}</p>
        </div>
      )}

      {/* ── Done ── */}
      {step === 'done' && (
        <div className="space-y-4 animate-fade-in text-center py-8">
          <CheckCircle size={40} className="mx-auto text-green-500" />
          <h3 className="text-sm font-semibold text-slate-900">{status}</h3>
          {(sent > 0 || received > 0) && (
            <div className="flex gap-2 justify-center text-xs text-slate-500">
              <span className="bg-slate-100 px-2 py-1 rounded">{sent} sent</span>
              <span className="bg-slate-100 px-2 py-1 rounded">{received} received</span>
            </div>
          )}
          {offlineResult && (
            <div className="flex gap-2 justify-center text-xs text-slate-500">
              <span className="bg-green-50 text-green-600 px-2 py-1 rounded">{offlineResult.accepted} accepted</span>
              {offlineResult.rejected > 0 && (
                <span className="bg-red-50 text-red-600 px-2 py-1 rounded">{offlineResult.rejected} rejected</span>
              )}
            </div>
          )}
          <button onClick={reset} className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium active:bg-slate-800 transition-colors duration-150">
            Connect to another device
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event('open-mesh-graph'))}
            className="text-xs text-slate-500 underline"
          >
            View network
          </button>
          <SyncActivityLog />
        </div>
      )}

      {/* ── Error ── */}
      {step === 'error' && (
        <div className="space-y-4 animate-fade-in text-center py-8">
          <AlertCircle size={40} className="mx-auto text-red-500" />
          <h3 className="text-sm font-semibold text-slate-900">Connection failed</h3>
          <p className="text-sm text-slate-500">{errorMsg}</p>
          <div className="flex flex-col gap-2">
            <button onClick={reset} className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium active:bg-slate-800 transition-colors duration-150">
              Try again
            </button>
            <button
              onClick={() => { reset(); setTimeout(() => setStep('offline-choose'), 50) }}
              className="px-6 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium active:bg-slate-50 transition-colors duration-150 flex items-center justify-center gap-2"
            >
              <QrCode size={14} /> Try offline sync instead
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
