import { useState, useCallback, useEffect } from 'react'
import {
  Archive, QrCode, Camera, CheckCircle, Loader2, Printer,
} from 'lucide-react'
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

export function DropsScreen() {
  const [tab, setTab] = useState<Tab>('create')
  const [step, setStep] = useState<Step>('idle')
  const [frames, setFrames] = useState<string[]>([])
  const [rawPayload, setRawPayload] = useState('')
  const [posterOpen, setPosterOpen] = useState(false)
  const [result, setResult] = useState<{ accepted: number; rejected: number } | null>(null)
  const [preview, setPreview] = useState({ news: 0, alerts: 0 })

  const appendEvent = useSyncStore((s) => s.appendEvent)
  const showToast = useUiStore((s) => s.showToast)

  // Load preview counts
  useEffect(() => {
    if (tab === 'create') {
      Promise.all([
        getVisibleMessages('news'),
        getVisibleMessages('alert'),
      ]).then(([news, alerts]) => {
        setPreview({ news: Math.min(news.length, 10), alerts: Math.min(alerts.length, 3) })
      })
    }
  }, [tab])

  const generateBundle = useCallback(async () => {
    setStep('generating')
    const b64 = await buildDropBundle()
    setRawPayload(b64)
    const qrFrames = await chunkForAnimatedQR(b64)
    setFrames(qrFrames)
    setStep('showing')
  }, [])

  const startScan = useCallback(() => {
    setStep('scanning')
    setResult(null)
  }, [])

  const onScanComplete = useCallback(async (b64: string) => {
    setStep('ingesting')
    try {
      const identity = await getOrCreateIdentity()
      const alias = await deriveAlias(identity.publicKey)
      const res = await ingestDropBundle(b64, identity, alias)
      setResult(res)
      setStep('done')
      appendEvent({ t: Date.now(), kind: 'sync-complete' })
      if (res.accepted > 0) {
        showToast(`${res.accepted} message${res.accepted !== 1 ? 's' : ''} from community drop`)
      }
    } catch {
      setResult({ accepted: 0, rejected: 0 })
      setStep('done')
    }
  }, [appendEvent, showToast])

  const reset = useCallback(() => {
    setStep('idle')
    setFrames([])
    setRawPayload('')
    setResult(null)
  }, [])

  return (
    <>
      <div className="p-4">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200 mb-4">
          {(['create', 'scan'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); reset() }}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors duration-150 ${
                tab === t
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400'
              }`}
            >
              {t === 'create' ? 'Create' : 'Scan'}
            </button>
          ))}
        </div>

        {/* ── Create tab ── */}
        {tab === 'create' && (
          <div className="flex flex-col items-center">
            {step === 'idle' && (
              <div className="w-full max-w-sm space-y-4 animate-fade-in">
                <div className="text-center py-4">
                  <Archive size={40} className="mx-auto text-slate-300 mb-3" />
                  <h2 className="text-lg font-semibold text-slate-900">Create poster</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Bundle recent messages into a QR poster anyone can scan.
                  </p>
                </div>

                {/* Preview */}
                <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Will include
                  </p>
                  <p className="text-sm text-slate-700">
                    {preview.news} news post{preview.news !== 1 ? 's' : ''}
                    {preview.alerts > 0 && ` + ${preview.alerts} alert${preview.alerts !== 1 ? 's' : ''}`}
                  </p>
                </div>

                <button
                  onClick={generateBundle}
                  disabled={preview.news + preview.alerts === 0}
                  className={`w-full py-3 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center justify-center gap-2 ${
                    preview.news + preview.alerts > 0
                      ? 'bg-slate-900 text-white active:bg-slate-800'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <QrCode size={16} />
                  Generate QR
                </button>
              </div>
            )}

            {step === 'generating' && (
              <div className="py-8 animate-fade-in text-center">
                <Loader2 size={32} className="mx-auto text-slate-400 animate-spin" />
                <p className="text-sm text-slate-500 mt-3">Compressing messages...</p>
              </div>
            )}

            {step === 'showing' && (
              <div className="space-y-4 animate-fade-in text-center">
                <h3 className="text-sm font-semibold text-slate-700">Community drop</h3>
                <QRDisplay frames={frames} />
                <p className="text-xs text-slate-500">
                  {frames.length} QR frame{frames.length !== 1 ? 's' : ''} — hold camera steady
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPosterOpen(true)}
                    className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium active:bg-slate-50 transition-colors duration-150 flex items-center justify-center gap-1.5"
                  >
                    <Printer size={14} />
                    Print-ready view
                  </button>
                  <button
                    onClick={reset}
                    className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium active:bg-slate-800 transition-colors duration-150"
                  >
                    Done
                  </button>
                </div>

                {import.meta.env.DEV && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(rawPayload)
                      showToast('Payload copied to clipboard')
                    }}
                    className="text-xs text-slate-400 underline"
                  >
                    Copy payload (dev)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Scan tab ── */}
        {tab === 'scan' && (
          <div className="flex flex-col items-center">
            {step === 'idle' && (
              <div className="w-full max-w-sm space-y-4 animate-fade-in">
                <div className="text-center py-4">
                  <Camera size={40} className="mx-auto text-slate-300 mb-3" />
                  <h2 className="text-lg font-semibold text-slate-900">Scan poster</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Point your camera at a community QR poster to ingest messages.
                  </p>
                </div>
                <button
                  onClick={startScan}
                  className="w-full py-3 rounded-lg bg-slate-900 text-white text-sm font-medium active:bg-slate-800 transition-colors duration-150 flex items-center justify-center gap-2"
                >
                  <Camera size={16} />
                  Start scanning
                </button>
              </div>
            )}

            {step === 'scanning' && (
              <div className="space-y-4 animate-fade-in text-center">
                <h3 className="text-sm font-semibold text-slate-700">Scanning poster</h3>
                <QRScanner mode="animated" onComplete={onScanComplete} />
                <button onClick={reset} className="text-xs text-slate-400 underline">
                  Cancel
                </button>
              </div>
            )}

            {step === 'ingesting' && (
              <div className="py-8 animate-fade-in text-center">
                <Loader2 size={32} className="mx-auto text-blue-500 animate-spin" />
                <p className="text-sm text-slate-500 mt-3">Verifying messages...</p>
              </div>
            )}

            {step === 'done' && result && (
              <div className="space-y-4 animate-fade-in text-center py-8">
                <CheckCircle size={40} className="mx-auto text-green-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Accepted {result.accepted} message{result.accepted !== 1 ? 's' : ''} from community drop.
                </h3>
                {result.rejected > 0 && (
                  <p className="text-xs text-slate-500">
                    {result.rejected} message{result.rejected !== 1 ? 's' : ''} rejected (invalid or duplicate).
                  </p>
                )}
                <button
                  onClick={reset}
                  className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium active:bg-slate-800 transition-colors duration-150"
                >
                  Scan another
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Poster modal */}
      {posterOpen && (
        <PosterView
          title="Community News"
          frames={frames}
          createdAt={Date.now()}
          onClose={() => setPosterOpen(false)}
        />
      )}
    </>
  )
}
