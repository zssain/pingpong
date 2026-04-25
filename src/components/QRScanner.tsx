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
  const [status, setStatus] = useState('Starting camera...')
  const [progress, setProgress] = useState<{ have: number; total: number } | null>(null)

  // For animated mode, collect frames by pid
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
          if (err) return // no-result frames are normal, just skip
          if (!result) return

          const text = result.getText()

          if (mode === 'single') {
            completedRef.current = true
            controlsRef.current?.stop()
            onComplete(text)
            return
          }

          // Animated mode: parse the frame
          try {
            const frame = JSON.parse(text) as QRFrame
            if (frame.v !== 1 || typeof frame.seq !== 'number') return

            // Get or create frame map for this payload ID
            if (!framesRef.current.has(frame.pid)) {
              framesRef.current.set(frame.pid, new Map())
            }
            const frameMap = framesRef.current.get(frame.pid)!
            frameMap.set(frame.seq, frame)

            setProgress({ have: frameMap.size, total: frame.tot })
            setStatus(`Captured ${frameMap.size} / ${frame.tot} frames`)

            // Check if we have all frames
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
            // Not a valid animated frame — might be a single QR, try using it directly
            completedRef.current = true
            controlsRef.current?.stop()
            onComplete(text)
          }
        },
      )
      .then((controls) => {
        controlsRef.current = controls
        setStatus('Scanning...')
      })
      .catch((err: Error) => {
        const msg = err.message || ''
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setStatus('Camera permission denied')
        } else {
          setStatus('Camera error')
        }
        onError?.(err)
      })

    return () => {
      completedRef.current = true
      controlsRef.current?.stop()
    }
  }, [mode, onComplete, onError])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-64 h-64 rounded-lg overflow-hidden border border-slate-200 bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        {/* Scanning overlay */}
        <div className="absolute inset-0 border-2 border-blue-400/50 rounded-lg pointer-events-none" />
      </div>
      <span className="text-xs text-slate-500">{status}</span>
      {progress && mode === 'animated' && (
        <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-200"
            style={{ width: `${(progress.have / progress.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}
