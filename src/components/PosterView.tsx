import { X, Printer } from 'lucide-react'
import { QRDisplay } from './QRDisplay'

interface Props {
  title: string
  frames: string[]
  createdAt: number
  onClose: () => void
}

export function PosterView({ title, frames, createdAt, onClose }: Props) {
  const dateStr = new Date(createdAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const isSingleFrame = frames.length === 1

  return (
    <div className="fixed inset-0 z-[90] bg-bg flex flex-col animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-border no-print shrink-0">
        <button onClick={() => window.print()} className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-muted hover:text-accent transition-colors duration-150">
          <Printer size={14} /> PRINT
        </button>
        <button onClick={onClose} className="p-1 text-text-muted hover:text-text transition-colors duration-150">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
        <div className="poster bg-white border border-border p-8 text-center max-w-md w-full">
          <h1 className="text-2xl font-bold text-[#0E0F11] mb-2">{title}</h1>
          <p className="text-sm text-[#4A4D52] mb-6">{dateStr}</p>
          <div className="flex justify-center">
            {isSingleFrame ? <QRDisplay text={frames[0]} /> : <QRDisplay frames={frames} />}
          </div>
          <p className="text-sm text-[#2A2D31] mt-6 font-medium">Scan with Wisp app. Works offline.</p>
          <p className="text-xs text-[#4A4D52] mt-2">Generated {dateStr}</p>
        </div>
      </div>
    </div>
  )
}
