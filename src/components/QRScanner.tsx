import { useEffect, useRef, useState, useCallback } from 'react'
import type { QRFrame } from '../transport/qr'
import { reassembleAnimatedQR } from '../transport/qr'

interface Props {
  mode: 'single' | 'animated'
  onComplete: (text: string) => void
  onError?: (err: Error) => void
}

// Check if native BarcodeDetector is available (Chrome, Safari 17.2+)
const hasNativeDetector = typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis

export function QRScanner({ mode, onComplete, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const completedRef = useRef(false)
  const scanLoopRef = useRef<number | null>(null)
  const [status, setStatus] = useState('STARTING CAMERA')
  const [progress, setProgress] = useState<{ have: number; total: number } | null>(null)
  const framesRef = useRef<Map<string, Map<number, QRFrame>>>(new Map())

  const handleResult = useCallback((text: string) => {
    if (completedRef.current) return

    if (mode === 'single') {
      completedRef.current = true
      onComplete(text)
      return
    }

    // Animated mode
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
          onComplete(assembled)
        }
      }
    } catch {
      // Not a JSON frame — treat as single raw payload
      completedRef.current = true
      onComplete(text)
    }
  }, [mode, onComplete])

  useEffect(() => {
    if (!videoRef.current) return
    completedRef.current = false
    let cancelled = false

    async function startScanning() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        videoRef.current!.srcObject = stream
        await videoRef.current!.play()
        setStatus('SCANNING')

        if (hasNativeDetector) {
          // Use native BarcodeDetector — much more reliable
          const detector = new (globalThis as any).BarcodeDetector({ formats: ['qr_code'] })

          const scanFrame = async () => {
            if (cancelled || completedRef.current) return
            try {
              const barcodes = await detector.detect(videoRef.current!)
              for (const barcode of barcodes) {
                if (barcode.rawValue) {
                  handleResult(barcode.rawValue)
                  if (completedRef.current) return
                }
              }
            } catch { /* frame not ready */ }
            scanLoopRef.current = requestAnimationFrame(scanFrame)
          }
          scanLoopRef.current = requestAnimationFrame(scanFrame)
        } else {
          // Fallback to @zxing/browser
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          const reader = new BrowserMultiFormatReader()
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: 'environment' } },
            videoRef.current!,
            (result) => {
              if (!result || completedRef.current) return
              handleResult(result.getText())
            },
          )
          streamRef.current = null // zxing manages its own stream
          // Store controls for cleanup
          ;(videoRef.current as any).__zxingControls = controls
        }
      } catch (err) {
        if (cancelled) return
        const msg = (err as Error).message || ''
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setStatus('CAMERA PERMISSION DENIED')
        } else {
          setStatus('CAMERA ERROR')
        }
        onError?.(err as Error)
      }
    }

    startScanning()

    return () => {
      cancelled = true
      completedRef.current = true
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      const zxControls = (videoRef.current as any)?.__zxingControls
      if (zxControls) zxControls.stop()
    }
  }, [mode, onComplete, onError, handleResult])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-72 h-72">
        <span className="absolute -top-1 -left-1 w-3 h-3 border-t border-l border-accent z-10" />
        <span className="absolute -top-1 -right-1 w-3 h-3 border-t border-r border-accent z-10" />
        <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b border-l border-accent z-10" />
        <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b border-r border-accent z-10" />
        <video
          ref={videoRef}
          className="w-full h-full bg-surface-2 object-cover"
          playsInline
          muted
          autoPlay
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
