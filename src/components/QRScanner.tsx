import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { QRFrame } from '../transport/qr'
import { reassembleAnimatedQR } from '../transport/qr'

interface Props {
  mode: 'single' | 'animated'
  onComplete: (text: string) => void
  onError?: (err: Error) => void
}

export function QRScanner({ mode, onComplete, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const completedRef = useRef(false)
  const [status, setStatus] = useState('STARTING CAMERA')
  const [progress, setProgress] = useState<{ have: number; total: number } | null>(null)

  const framesRef = useRef<Map<string, Map<number, QRFrame>>>(new Map())

  useEffect(() => {
    if (!videoRef.current) return
    completedRef.current = false

    const reader = new BrowserMultiFormatReader()

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result, err) => {
          if (completedRef.current) return
          if (err) return
          if (!result) return

          const text = result.getText()

          if (mode === 'single') {
            completedRef.current = true
            controlsRef.current?.stop()
            onComplete(text)
            return
          }

          try {
            const frame = JSON.parse(text) as QRFrame
            if (frame.v !== 1 || typeof frame.seq !== 'number') return

            if (!framesRef.current.has(frame.pid)) {
              framesRef.current.set(frame.pid, new Map())
            }
            const frameMap = framesRef.current.get(frame.pid)!
            frameMap.set(frame.seq, frame)

            setProgress({ have: frameMap.size, total: frame.tot })
            setStatus(`FRAME ${frameMap.size} / ${frame.tot}`)

            if (frameMap.size >= frame.tot) {
              const allFrames = Array.from(frameMap.values())
              const assembled = reassembleAnimatedQR(allFrames)
              if (assembled) {
                completedRef.current = true
                controlsRef.current?.stop()
                onComplete(assembled)
              }
            }
          } catch {
            completedRef.current = true
            controlsRef.current?.stop()
            onComplete(text)
          }
        },
      )
      .then((controls) => {
        controlsRef.current = controls
        setStatus('SCANNING')
      })
      .catch((err: Error) => {
        const msg = err.message || ''
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setStatus('CAMERA PERMISSION DENIED')
        } else {
          setStatus('CAMERA ERROR')
        }
        onError?.(err)
      })

    return () => {
      completedRef.current = true
      controlsRef.current?.stop()
    }
  }, [mode, onComplete, onError])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-64 h-64">
        <span className="absolute -top-1 -left-1 w-3 h-3 border-t border-l border-accent z-10" />
        <span className="absolute -top-1 -right-1 w-3 h-3 border-t border-r border-accent z-10" />
        <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b border-l border-accent z-10" />
        <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b border-r border-accent z-10" />
        <video
          ref={videoRef}
          className="w-full h-full bg-surface-2 object-cover"
          playsInline
          muted
        />
        <span className="absolute inset-8 border border-accent/40 pointer-events-none" />
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">{status}</span>
      {progress && mode === 'animated' && (
        <div className="w-48 h-1 bg-border overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-200"
            style={{ width: `${(progress.have / progress.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}
