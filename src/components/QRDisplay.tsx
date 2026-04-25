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

  // Generate QR image whenever the current text changes
  useEffect(() => {
    let cancelled = false
    if (currentText) {
      encodeToQR(currentText).then((url) => {
        if (!cancelled) setDataUrl(url)
      })
    }
    return () => { cancelled = true }
  }, [currentText])

  // Cycle frames at 2 fps for animated mode
  useEffect(() => {
    if (!isAnimated) return
    intervalRef.current = setInterval(() => {
      setFrameIndex((i) => (i + 1) % props.frames!.length)
    }, 500)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isAnimated, props.frames])

  return (
    <div className="flex flex-col items-center gap-2">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="QR Code"
          className="w-64 h-64 rounded-lg border border-slate-200"
        />
      ) : (
        <div className="w-64 h-64 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
          <span className="text-sm text-slate-400">Generating...</span>
        </div>
      )}
      {isAnimated && (
        <span className="text-xs text-slate-400">
          Frame {frameIndex + 1} of {props.frames!.length}
        </span>
      )}
    </div>
  )
}
