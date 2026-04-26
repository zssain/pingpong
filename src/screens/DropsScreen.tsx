import { useState, useCallback, useEffect } from 'react'
import { QrCode, Camera, Printer } from 'lucide-react'
import { buildDropBundle, ingestDropBundle } from '../transport/dropbundle'
import { chunkForAnimatedQR } from '../transport/qr'
import { getVisibleMessages, getOrCreateIdentity } from '../db'
import { deriveAlias } from '../lib/identity'
import { QRDisplay } from '../components/QRDisplay'
import { QRScanner } from '../components/QRScanner'
import { PosterView } from '../components/PosterView'
import { useSyncStore } from '../store/sync'
import { useUiStore } from '../store/ui'

type Tab = 'create' | 'scan'
type Step = 'idle' | 'generating' | 'showing' | 'scanning' | 'ingesting' | 'done'

const BTN_PRIMARY = 'w-full py-3 text-xs font-mono uppercase tracking-[0.2em] border border-accent text-accent bg-accent/5 hover:bg-accent/15 active:scale-[0.98] transition-all duration-150'
const BTN_SECONDARY = 'w-full py-3 text-xs font-mono uppercase tracking-[0.2em] border border-border text-text-muted hover:border-border-mid hover:text-text active:scale-[0.98] transition-all duration-150'
const BTN_TERTIARY = 'text-[10px] font-mono uppercase tracking-wider text-text-muted hover:text-text transition-colors'
const HEADING = 'text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted'

export function DropsScreen() {
  const [tab, setTab] = useState<Tab>('create')
  const [step, setStep] = useState<Step>('idle')
  const [frames, setFrames] = useState<string[]>([])
  const [rawPayload, setRawPayload] = useState('')
  const [posterOpen, setPosterOpen] = useState(false)
  const [result, setResult] = useState<{ accepted: number; rejected: number } | null>(null)
  const [preview, setPreview] = useState({ news: 0, alerts: 0 })
  const [pasteCode, setPasteCode] = useState('')

  const appendEvent = useSyncStore((s) => s.appendEvent)
  const showToast = useUiStore((s) => s.showToast)

  useEffect(() => {
    if (tab === 'create') {
      Promise.all([getVisibleMessages('news'), getVisibleMessages('alert')]).then(([news, alerts]) => {
        setPreview({ news: Math.min(news.length, 10), alerts: Math.min(alerts.length, 3) })
      })
    }
  }, [tab])

  const generateBundle = useCallback(async () => {
    setStep('generating')
    const b64 = await buildDropBundle(); setRawPayload(b64)
    const qrFrames = await chunkForAnimatedQR(b64); setFrames(qrFrames); setStep('showing')
  }, [])

  const startScan = useCallback(() => { setStep('scanning'); setResult(null) }, [])

  const onScanComplete = useCallback(async (b64: string) => {
    setStep('ingesting')
    try {
      const identity = await getOrCreateIdentity(); const alias = await deriveAlias(identity.publicKey)
      const res = await ingestDropBundle(b64, identity, alias); setResult(res); setStep('done')
      appendEvent({ t: Date.now(), kind: 'sync-complete' })
      if (res.accepted > 0) showToast(`${res.accepted} message${res.accepted !== 1 ? 's' : ''} from community drop`)
    } catch { setResult({ accepted: 0, rejected: 0 }); setStep('done') }
  }, [appendEvent, showToast])

  const reset = useCallback(() => { setStep('idle'); setFrames([]); setRawPayload(''); setResult(null); setPasteCode('') }, [])

  return (
    <>
      <div className="p-4">
        <div className="flex border-b border-border mb-5">
          {(['create', 'scan'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); reset() }}
              className={`flex-1 py-2.5 text-[11px] font-mono uppercase tracking-[0.2em] border-b-2 transition-colors duration-150 ${
                tab === t ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-text-muted'
              }`}
            >
              {t === 'create' ? 'CREATE' : 'SCAN'}
            </button>
          ))}
        </div>

        {tab === 'create' && (
          <div className="flex flex-col items-center">
            {step === 'idle' && (
              <div className="w-full max-w-sm space-y-4 animate-fade-in">
                <div className="text-center py-4 space-y-2">
                  <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-text-muted">CREATE POSTER</h2>
                  <p className="text-xs font-mono text-text-dim">Bundle recent messages into a QR poster anyone can scan.</p>
                </div>
                <div className="border border-border p-4 space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-dim">WILL INCLUDE</p>
                  <p className="text-sm font-mono text-text">
                    {preview.news} news post{preview.news !== 1 ? 's' : ''}
                    {preview.alerts > 0 && ` + ${preview.alerts} alert${preview.alerts !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <button
                  onClick={generateBundle}
                  disabled={preview.news + preview.alerts === 0}
                  className={preview.news + preview.alerts > 0 ? `${BTN_PRIMARY} flex items-center justify-center gap-2` : `w-full py-3 text-xs font-mono uppercase tracking-[0.2em] border border-border text-text-dim cursor-not-allowed`}
                >
                  <QrCode size={14} /> GENERATE QR
                </button>
              </div>
            )}
            {step === 'generating' && (
              <div className="py-12 animate-fade-in text-center space-y-3">
                <div className="flex justify-center gap-1">
                  <span className="w-1 h-1 bg-accent animate-pulse" />
                  <span className="w-1 h-1 bg-accent animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-accent animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-[11px] font-mono text-text-dim">COMPRESSING</p>
              </div>
            )}
            {step === 'showing' && (
              <div className="space-y-4 animate-fade-in text-center w-full max-w-xs">
                <h3 className={HEADING}>COMMUNITY DROP</h3>
                <QRDisplay frames={frames} />
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">
                  {frames.length} FRAME{frames.length !== 1 ? 'S' : ''} — HOLD CAMERA STEADY
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPosterOpen(true)} className={`flex-1 ${BTN_SECONDARY} flex items-center justify-center gap-1.5`}>
                    <Printer size={12} /> PRINT VIEW
                  </button>
                  <button onClick={reset} className={`flex-1 ${BTN_PRIMARY}`}>DONE</button>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(rawPayload); showToast('Code copied — paste on other device') }} className={BTN_SECONDARY}>
                  COPY CODE
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'scan' && (
          <div className="flex flex-col items-center">
            {step === 'idle' && (
              <div className="w-full max-w-sm space-y-4 animate-fade-in">
                <div className="text-center py-4 space-y-2">
                  <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-text-muted">SCAN POSTER</h2>
                  <p className="text-xs font-mono text-text-dim">Point camera at a community QR poster.</p>
                </div>
                <button onClick={startScan} className={`${BTN_PRIMARY} flex items-center justify-center gap-2`}>
                  <Camera size={14} /> START SCANNING
                </button>
              </div>
            )}
            {step === 'scanning' && (
              <div className="space-y-4 animate-fade-in text-center w-full max-w-xs">
                <h3 className={HEADING}>SCANNING POSTER</h3>
                <QRScanner mode="animated" onComplete={onScanComplete} />

                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">OR PASTE CODE</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <textarea
                  value={pasteCode}
                  onChange={(e) => setPasteCode(e.target.value)}
                  placeholder="Paste the code from the other device..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs font-mono bg-surface-2 border border-border text-text placeholder:text-text-dim resize-none focus:outline-none focus:border-accent transition-colors duration-150"
                />
                <button
                  onClick={() => { if (pasteCode.trim()) onScanComplete(pasteCode.trim()) }}
                  disabled={!pasteCode.trim()}
                  className={pasteCode.trim() ? BTN_PRIMARY : 'w-full py-3 text-xs font-mono uppercase tracking-[0.2em] border border-border text-text-dim cursor-not-allowed'}
                >
                  IMPORT
                </button>
                <button onClick={reset} className={BTN_TERTIARY}>CANCEL</button>
              </div>
            )}
            {step === 'ingesting' && (
              <div className="py-12 animate-fade-in text-center space-y-3">
                <div className="flex justify-center gap-1">
                  <span className="w-1 h-1 bg-accent animate-pulse" />
                  <span className="w-1 h-1 bg-accent animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-accent animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-[11px] font-mono text-text-dim">VERIFYING</p>
              </div>
            )}
            {step === 'done' && result && (
              <div className="space-y-4 animate-fade-in text-center py-12 w-full max-w-xs">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-success">COMPLETE</div>
                <p className="text-sm font-mono text-text">
                  Accepted {result.accepted} message{result.accepted !== 1 ? 's' : ''} from community drop.
                </p>
                {result.rejected > 0 && (
                  <span className="inline-block text-[10px] font-mono uppercase tracking-wider text-alert border border-alert/40 px-2 py-1">
                    {result.rejected} REJECTED
                  </span>
                )}
                <button onClick={reset} className={BTN_PRIMARY}>SCAN ANOTHER</button>
              </div>
            )}
          </div>
        )}
      </div>
      {posterOpen && <PosterView title="Community News" frames={frames} createdAt={Date.now()} onClose={() => setPosterOpen(false)} />}
    </>
  )
}
