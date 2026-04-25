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
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const isSingleFrame = frames.length === 1

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
      {/* Header — hidden in print */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 no-print">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors duration-150"
        >
          <Printer size={16} />
          Print
        </button>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 transition-colors duration-150"
        >
          <X size={20} />
        </button>
      </div>

      {/* Poster content */}
      <div className="poster flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 mb-6">{dateStr}</p>

        <div className="flex-1 flex items-center justify-center max-h-[65vh]">
          {isSingleFrame ? (
            <QRDisplay text={frames[0]} />
          ) : (
            <QRDisplay frames={frames} />
          )}
        </div>

        <p className="text-sm text-slate-600 mt-6 font-medium">
          Scan with Mesh app. Works offline.
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Generated {dateStr}
        </p>
      </div>
    </div>
  )
}
