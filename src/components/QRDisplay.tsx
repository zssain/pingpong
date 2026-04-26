import { useState, useEffect, useRef } from 'react'
import { encodeToQR } from '../transport/qr'

interface SingleProps {
  text: string
  frames?: never
}

interface AnimatedProps {
  text?: never
  frames: string[]
}

type Props = SingleProps | AnimatedProps

export function QRDisplay(props: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isAnimated = !!props.frames && props.frames.length > 1
  const currentText = isAnimated
    ? props.frames![frameIndex]
    : props.frames
      ? props.frames[0]
      : props.text

  useEffect(() => {
    let cancelled = false
    if (currentText) {
      encodeToQR(currentText).then((url) => {
        if (!cancelled) setDataUrl(url)
      })
    }
    return () => { cancelled = true }
  }, [currentText])

  // Cycle frames — slower for fewer frames, faster for many
  useEffect(() => {
    if (!isAnimated) return
    const frameCount = props.frames!.length
    // 2-3 frames: 1.5s per frame; 4-10: 800ms; 10+: 500ms
    const interval = frameCount <= 3 ? 1500 : frameCount <= 10 ? 800 : 500
    intervalRef.current = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frameCount)
    }, interval)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isAnimated, props.frames])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <span className="absolute -top-1 -left-1 w-3 h-3 border-t border-l border-accent" />
        <span className="absolute -top-1 -right-1 w-3 h-3 border-t border-r border-accent" />
        <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b border-l border-accent" />
        <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b border-r border-accent" />
        {dataUrl ? (
          <div className="w-72 h-72 bg-white p-3 flex items-center justify-center">
            <img
              src={dataUrl}
              alt="QR Code"
              className="w-full h-full"
            />
          </div>
        ) : (
          <div className="w-72 h-72 bg-surface-2 border border-border flex items-center justify-center">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">
              GENERATING
            </span>
          </div>
        )}
      </div>
      {isAnimated && (
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
          FRAME {frameIndex + 1} / {props.frames!.length}
        </span>
      )}
    </div>
  )
}
