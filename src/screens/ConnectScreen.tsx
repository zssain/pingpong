import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Wifi, WifiOff, QrCode, Share2, Camera, ChevronDown,
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

// ─── Envelope types ──────────────────────────────────────────────────
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

// ─── Button styles ───────────────────────────────────────────────────
const BTN_PRIMARY = 'w-full py-3 text-xs font-mono uppercase tracking-[0.2em] border border-accent text-accent bg-accent/5 hover:bg-accent/15 active:scale-[0.98] transition-all duration-150'
const BTN_SECONDARY = 'w-full py-3 text-xs font-mono uppercase tracking-[0.2em] border border-border text-text-muted hover:border-border-mid hover:text-text active:scale-[0.98] transition-all duration-150'
const BTN_TERTIARY = 'text-[10px] font-mono uppercase tracking-wider text-text-muted hover:text-text transition-colors'
const HEADING = 'text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted'
const SUBTEXT = 'text-[11px] font-mono text-text-dim'

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

  // ── Network detection ──────────────────────────────────────────────
  useEffect(() => {
    async function detect() {
      const netState = detectNetworkState()
      if (netState === 'offline') { setNetworkMode('offline'); return }
      const webrtcOk = await probeWebRTCViability()
      setNetworkMode(webrtcOk ? 'lan' : 'offline')
    }
    detect()
  }, [setNetworkMode])

  useEffect(() => {
    const onOnline = () => { probeWebRTCViability().then((ok) => setNetworkMode(ok ? 'lan' : 'offline')) }
    const onOffline = () => setNetworkMode('offline')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [setNetworkMode])

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
    if (handshakeTimerRef.current) { clearTimeout(handshakeTimerRef.current); handshakeTimerRef.current = null }
  }, [])

  // ── Tier 1: Sync protocol ─────────────────────────────────────────
  const runSync = useCallback(async (peer: MeshPeer) => {
    clearHandshakeTimer(); resetHandshakeFail()
    setStep('syncing'); setSyncPhase('handshaking')
    setStatus('Exchanging fingerprints...'); sentDoneRef.current = false
    let sentCount = 0; let recvCount = 0
    const identity = await getOrCreateIdentity()
    const alias = await deriveAlias(identity.publicKey)
    const fp = await buildLocalFingerprint()
    peer.send(JSON.stringify({ t: 'fp', data: uint8ToBase64(fp) } as FpEnvelope))

    peer.onData(async (raw: Uint8Array) => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      let env: Envelope
      try { env = JSON.parse(new TextDecoder().decode(raw)) as Envelope } catch { return }

      if (env.t === 'fp') {
        setSyncPhase('syncing'); setStatus('Sending messages...')
        const peerFp = base64ToUint8(env.data)
        const missingIds = await computeMissingIds(peerFp)
        const toSend = await packMessagesForSend(missingIds)
        for (const msg of toSend) {
          peer.send(JSON.stringify({ t: 'msg', data: JSON.stringify(msg) } as MsgEnvelope))
          sentCount++; setSent(sentCount)
          appendEvent({ t: Date.now(), kind: 'msg-sent', messageId: msg.id })
          recordHop(identity.publicKey, 'peer', msg.id, alias)
        }
        idleTimerRef.current = setTimeout(() => {
          if (!sentDoneRef.current) { sentDoneRef.current = true; peer.send(JSON.stringify({ t: 'done', sent: sentCount, alias } as DoneEnvelope)); finishSync(sentCount, recvCount, null) }
        }, 2000)
      }
      if (env.t === 'msg') {
        setSyncPhase('syncing'); setStatus('Receiving messages...')
        try {
          const msg = JSON.parse(env.data)
          const result = await ingestReceivedMessage(msg, identity, alias)
          if (result.accepted) {
            recvCount++; setReceived(recvCount)
            appendEvent({ t: Date.now(), kind: 'msg-received', messageId: msg.id })
            if (msg.authorPubkey) recordHop(msg.authorPubkey, identity.publicKey, msg.id, msg.authorAlias, alias)
          }
        } catch (e) { console.warn('[sync] Ingest error:', e) }
        idleTimerRef.current = setTimeout(() => {
          if (!sentDoneRef.current) { sentDoneRef.current = true; peer.send(JSON.stringify({ t: 'done', sent: sentCount, alias } as DoneEnvelope)); finishSync(sentCount, recvCount, null) }
        }, 2000)
      }
      if (env.t === 'done') {
        const remoteAlias = (env as DoneEnvelope).alias ?? null
        if (remoteAlias) setPeerAlias(remoteAlias)
        if (!sentDoneRef.current) { sentDoneRef.current = true; peer.send(JSON.stringify({ t: 'done', sent: sentCount, alias } as DoneEnvelope)) }
        finishSync(sentCount, recvCount, remoteAlias)
      }
    })
    peer.onError((err) => { appendEvent({ t: Date.now(), kind: 'peer-disconnected', error: err.message }); setStep('error'); setErrorMsg(err.message || 'Connection lost') })
    peer.onClose(() => { finishSync(sentCount, recvCount, peerAlias) })

    function finishSync(s: number, r: number, remoteAlias: string | null) {
      setSyncPhase('complete'); setStep('done')
      setStatus(remoteAlias ? `${remoteAlias} shared ${r} message${r !== 1 ? 's' : ''}. You shared ${s}.` : `Sync complete. ${s + r} message${s + r !== 1 ? 's' : ''} exchanged.`)
      appendEvent({ t: Date.now(), kind: 'sync-complete', peerAlias: remoteAlias ?? undefined })
      refreshPeerCount()
      if (r > 0) showToast(`${r} new message${r !== 1 ? 's' : ''} from ${remoteAlias ?? 'peer'}`)
    }
  }, [appendEvent, recordHop, peerAlias, refreshPeerCount, showToast, clearHandshakeTimer, resetHandshakeFail])

  // ── Tier 1: Initiator ──────────────────────────────────────────────
  const startAsInitiator = useCallback(async () => {
    try {
      setStep('show-offer'); setStatus('Generating offer...'); setSent(0); setReceived(0)
      const peer = new MeshPeer({ initiator: true }); peerRef.current = peer
      const offerPayload = await peer.getSignalPayload()
      if (offerPayload.length > QR_SINGLE_LIMIT) { setOfferFrames(await chunkForAnimatedQR(offerPayload)) } else { setOfferFrames([offerPayload]) }
      setStatus('Show this QR to the other device'); startHandshakeTimer()
    } catch { setStep('error'); setErrorMsg('Failed to create offer') }
  }, [startHandshakeTimer])

  const onAnswerScanned = useCallback((payload: string) => {
    const peer = peerRef.current; if (!peer) return
    try { peer.acceptPeerSignal(payload) } catch { setStep('error'); setErrorMsg('Invalid answer QR'); return }
    setStatus('Connecting...'); appendEvent({ t: Date.now(), kind: 'peer-connected' })
    peer.onConnect(() => { clearHandshakeTimer(); setStep('connected'); setStatus('Connected!'); refreshPeerCount(); runSync(peer) })
  }, [runSync, appendEvent, refreshPeerCount, clearHandshakeTimer])

  const startAsResponder = useCallback(() => {
    setStep('scan-offer'); setStatus('Point camera at the offer QR'); setSent(0); setReceived(0); startHandshakeTimer()
  }, [startHandshakeTimer])

  const onOfferScanned = useCallback(async (payload: string) => {
    try {
      setStep('show-answer'); setStatus('Generating answer...')
      const peer = new MeshPeer({ initiator: false }); peerRef.current = peer
      peer.acceptPeerSignal(payload)
      const answerPayload = await peer.getSignalPayload()
      if (answerPayload.length > QR_SINGLE_LIMIT) { setAnswerFrames(await chunkForAnimatedQR(answerPayload)) } else { setAnswerFrames([answerPayload]) }
      setStatus('Show this QR to the other device')
      appendEvent({ t: Date.now(), kind: 'peer-connected' })
      peer.onConnect(() => { clearHandshakeTimer(); setStep('connected'); setStatus('Connected!'); refreshPeerCount(); runSync(peer) })
      peer.onError((err) => { appendEvent({ t: Date.now(), kind: 'peer-disconnected', error: err.message }); setStep('error'); setErrorMsg(err.message || 'Connection failed') })
    } catch { setStep('error'); setErrorMsg('Invalid offer QR') }
  }, [runSync, appendEvent, refreshPeerCount, clearHandshakeTimer])

  // ── Tier 2: Offline ────────────────────────────────────────────────
  const startOfflineShare = useCallback(async () => {
    try {
      setStep('offline-share'); setStatus('Preparing messages...')
      const b64 = await buildOfflinePayload(); const frames = await chunkForAnimatedQR(b64)
      setOfflineFrames(frames); setStatus(`${frames.length} QR frames — hold steady`)
    } catch { setStep('error'); setErrorMsg('Failed to build payload') }
  }, [])

  const startOfflineScan = useCallback(() => { setStep('offline-scan'); setStatus('Scanning...'); setOfflineResult(null) }, [])

  const onOfflinePayloadScanned = useCallback(async (b64: string) => {
    try {
      setStep('offline-ingesting'); setStatus('Verifying...')
      const identity = await getOrCreateIdentity(); const alias = await deriveAlias(identity.publicKey)
      const result = await ingestOfflinePayload(b64, identity, alias)
      setOfflineResult(result); setStep('done')
      setStatus(`Accepted ${result.accepted} message${result.accepted !== 1 ? 's' : ''}${result.rejected > 0 ? `, rejected ${result.rejected}` : ''}.`)
      appendEvent({ t: Date.now(), kind: 'sync-complete' }); refreshPeerCount()
      if (result.accepted > 0) showToast(`${result.accepted} new message${result.accepted !== 1 ? 's' : ''} via QR sync`)
    } catch { setStep('error'); setErrorMsg('Failed to parse QR payload') }
  }, [appendEvent, refreshPeerCount, showToast])

  // ── Reset ──────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    peerRef.current?.destroy(); peerRef.current = null
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    clearHandshakeTimer(); setStep('idle'); setStatus(''); setSent(0); setReceived(0)
    setErrorMsg(''); setOfferFrames([]); setAnswerFrames([]); setOfflineFrames([]); setOfflineResult(null)
    setPeerAlias(null); setShowTier1(false); sentDoneRef.current = false
  }, [clearHandshakeTimer])

  // ── Network badge ──────────────────────────────────────────────────
  function NetworkBadge() {
    return (
      <div className="flex items-center justify-center gap-2 py-2 border-y border-border">
        <span className={`w-1.5 h-1.5 ${isLan ? 'bg-success' : isOffline ? 'bg-accent' : 'bg-text-dim'}`} />
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
          {isLan ? 'LAN AVAILABLE' : isOffline ? 'NO PEERS REACHABLE' : 'DETECTING NETWORK'}
        </span>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="p-4 flex flex-col items-center min-h-full">

      {/* ── Idle ── */}
      {step === 'idle' && (
        <div className="w-full max-w-sm space-y-5 animate-fade-in pt-4">
          <div className="text-center space-y-2 pb-2">
            {isOffline ? (
              <WifiOff size={28} className="mx-auto text-accent stroke-1" />
            ) : (
              <Wifi size={28} className="mx-auto text-text-muted stroke-1" />
            )}
            <h2 className={HEADING}>CONNECT TO PEER</h2>
            <p className="text-xs font-mono text-text-dim">Exchange messages with a nearby device.</p>
          </div>

          <NetworkBadge />

          {isLan || networkMode === 'unknown' ? (
            <>
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-dim">WI-FI SYNC</p>
                <button onClick={startAsInitiator} className={BTN_PRIMARY}>CREATE OFFER</button>
                <button onClick={startAsResponder} className={BTN_SECONDARY}>SCAN OFFER</button>
              </div>
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">OR</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <button onClick={() => setStep('offline-choose')} className={BTN_SECONDARY + ' flex items-center justify-center gap-2'}>
                <QrCode size={14} /> CAMERA-TO-CAMERA QR SYNC
              </button>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-accent border border-accent-dim px-3 py-2">
                  <WifiOff size={11} className="shrink-0" />
                  <span>NO WI-FI — OFFLINE SYNC USES ONLY THE CAMERA</span>
                </div>
                <button onClick={() => setStep('offline-choose')} className={BTN_PRIMARY + ' flex items-center justify-center gap-2'}>
                  <QrCode size={14} /> OFFLINE SYNC
                </button>
              </div>
              <button onClick={() => setShowTier1(!showTier1)} className={`w-full flex items-center justify-center gap-1 py-2 ${BTN_TERTIARY}`}>
                <ChevronDown size={12} className={`transition-transform duration-150 ${showTier1 ? 'rotate-180' : ''}`} />
                ADVANCED — WI-FI SYNC
              </button>
              {showTier1 && (
                <div className="space-y-2 animate-fade-in">
                  <button onClick={startAsInitiator} className={BTN_SECONDARY}>CREATE OFFER</button>
                  <button onClick={startAsResponder} className={BTN_SECONDARY}>SCAN OFFER</button>
                </div>
              )}
            </>
          )}

          <SyncActivityLog />
        </div>
      )}

      {/* ── Offline choose ── */}
      {step === 'offline-choose' && (
        <div className="w-full max-w-sm space-y-5 animate-fade-in pt-4">
          <div className="text-center space-y-2 pb-2">
            <QrCode size={28} className="mx-auto text-text-muted stroke-1" />
            <h2 className={HEADING}>OFFLINE SYNC</h2>
            <p className="text-xs font-mono text-text-dim">No Wi-Fi needed — just point cameras at each other.</p>
          </div>
          <button onClick={startOfflineShare} className={BTN_PRIMARY + ' flex items-center justify-center gap-2'}>
            <Share2 size={14} /> SHARE MY MESSAGES
          </button>
          <button onClick={startOfflineScan} className={BTN_SECONDARY + ' flex items-center justify-center gap-2'}>
            <Camera size={14} /> SCAN MESSAGES
          </button>
          <button onClick={reset} className={`w-full text-center ${BTN_TERTIARY}`}>BACK</button>
        </div>
      )}

      {/* ── Offline share ── */}
      {step === 'offline-share' && (
        <div className="space-y-4 animate-fade-in text-center w-full max-w-xs">
          <h3 className={HEADING}>SHARING MESSAGES</h3>
          {offlineFrames.length > 0 ? <QRDisplay frames={offlineFrames} /> : (
            <div className="flex justify-center gap-1 py-8">
              <span className="w-1 h-1 bg-accent animate-pulse" />
              <span className="w-1 h-1 bg-accent animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-accent animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          <p className={SUBTEXT}>{status}</p>
          <button onClick={reset} className={BTN_PRIMARY}>DONE</button>
        </div>
      )}

      {/* ── Offline scan ── */}
      {step === 'offline-scan' && (
        <div className="space-y-4 animate-fade-in text-center w-full max-w-xs">
          <h3 className={HEADING}>SCANNING MESSAGES</h3>
          <QRScanner mode="animated" onComplete={onOfflinePayloadScanned} />
          <p className={SUBTEXT}>{status}</p>
          <button onClick={reset} className={BTN_TERTIARY}>CANCEL</button>
        </div>
      )}

      {/* ── Offline ingesting ── */}
      {step === 'offline-ingesting' && (
        <div className="space-y-4 animate-fade-in text-center py-12">
          <div className="flex justify-center gap-1">
            <span className="w-1 h-1 bg-accent animate-pulse" />
            <span className="w-1 h-1 bg-accent animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-accent animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          <p className={SUBTEXT}>{status}</p>
        </div>
      )}

      {/* ── Show offer ── */}
      {step === 'show-offer' && (
        <div className="space-y-4 animate-fade-in text-center w-full max-w-xs">
          <h3 className={HEADING}>YOUR OFFER</h3>
          <QRDisplay frames={offerFrames} />
          <p className={SUBTEXT}>Other device: tap "Scan offer" and point camera here</p>
          <button onClick={() => { setStep('scan-answer'); startHandshakeTimer() }} className={BTN_PRIMARY}>NEXT: SCAN THEIR ANSWER</button>
          <button onClick={reset} className={BTN_TERTIARY}>CANCEL</button>
        </div>
      )}

      {/* ── Scan answer ── */}
      {step === 'scan-answer' && (
        <div className="space-y-4 animate-fade-in text-center w-full max-w-xs">
          <h3 className={HEADING}>SCAN THEIR ANSWER</h3>
          <QRScanner mode="animated" onComplete={onAnswerScanned} />
          <button onClick={reset} className={BTN_TERTIARY}>CANCEL</button>
        </div>
      )}

      {/* ── Scan offer ── */}
      {step === 'scan-offer' && (
        <div className="space-y-4 animate-fade-in text-center w-full max-w-xs">
          <h3 className={HEADING}>SCAN OFFER QR</h3>
          <QRScanner mode="animated" onComplete={onOfferScanned} />
          <button onClick={reset} className={BTN_TERTIARY}>CANCEL</button>
        </div>
      )}

      {/* ── Show answer ── */}
      {step === 'show-answer' && (
        <div className="space-y-4 animate-fade-in text-center w-full max-w-xs">
          <h3 className={HEADING}>YOUR ANSWER</h3>
          <QRDisplay frames={answerFrames} />
          <p className={SUBTEXT}>Other device: scan this to complete the connection</p>
          <button onClick={reset} className={BTN_TERTIARY}>CANCEL</button>
        </div>
      )}

      {/* ── Connected / Syncing ── */}
      {(step === 'connected' || step === 'syncing') && (
        <div className="space-y-4 animate-fade-in text-center py-12">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent">SYNCING</div>
          <div className="flex justify-center gap-1">
            <span className="w-1 h-1 bg-accent animate-pulse" />
            <span className="w-1 h-1 bg-accent animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-accent animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          <SyncProgress phase={syncPhase} received={received} total={sent + received > 0 ? sent + received : undefined} />
          <p className={SUBTEXT}>{status}</p>
        </div>
      )}

      {/* ── Done ── */}
      {step === 'done' && (
        <div className="space-y-4 animate-fade-in text-center py-12 w-full max-w-xs">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-success">COMPLETE</div>
          <h3 className="text-sm font-mono text-text">{status}</h3>
          {(sent > 0 || received > 0) && (
            <div className="flex gap-2 justify-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted border border-border px-2 py-1">{sent} SENT</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted border border-border px-2 py-1">{received} RECEIVED</span>
            </div>
          )}
          {offlineResult && (
            <div className="flex gap-2 justify-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-success border border-success/40 px-2 py-1">{offlineResult.accepted} ACCEPTED</span>
              {offlineResult.rejected > 0 && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-alert border border-alert/40 px-2 py-1">{offlineResult.rejected} REJECTED</span>
              )}
            </div>
          )}
          <button onClick={reset} className={BTN_PRIMARY}>CONNECT TO ANOTHER DEVICE</button>
          <button onClick={() => window.dispatchEvent(new Event('open-mesh-graph'))} className={BTN_TERTIARY}>VIEW NETWORK GRAPH</button>
          <SyncActivityLog />
        </div>
      )}

      {/* ── Error ── */}
      {step === 'error' && (
        <div className="space-y-4 animate-fade-in text-center py-12 w-full max-w-xs">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-alert">CONNECTION FAILED</div>
          <p className={SUBTEXT}>{errorMsg}</p>
          <div className="flex flex-col gap-2">
            <button onClick={reset} className={BTN_PRIMARY}>TRY AGAIN</button>
            <button onClick={() => { reset(); setTimeout(() => setStep('offline-choose'), 50) }} className={BTN_SECONDARY + ' flex items-center justify-center gap-2'}>
              <QrCode size={12} /> TRY OFFLINE SYNC INSTEAD
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
