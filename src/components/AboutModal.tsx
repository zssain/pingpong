import { useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const blocks = [
  {
    label: 'IDENTITY',
    body: 'Your alias rotates daily. There are no accounts and no servers. Everything is signed and stored on your device.',
  },
  {
    label: 'TRANSPORTS',
    body: 'Messages travel through people via local Wi-Fi, camera-to-camera QR scans, and printed posters. Choose the right transport for your situation.',
  },
  {
    label: 'PANIC WIPE',
    body: 'Triple-tap the WISP wordmark in the header to instantly destroy all local data and regenerate a fresh identity.',
  },
]

export function AboutModal({ isOpen, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md bg-surface border border-border-mid p-5 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted">ABOUT WISP</span>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text transition-colors duration-150" aria-label="Close">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-mono text-text">WISP</p>
          <p className="text-[11px] font-mono uppercase tracking-wider text-text-dim">MESSAGES THAT TRAVEL WITHOUT A NETWORK</p>
        </div>

        <div className="space-y-3 pt-2">
          {blocks.map((b) => (
            <div key={b.label} className="border-l border-accent-dim pl-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent mb-1">{b.label}</p>
              <p className="text-xs font-body text-text-muted leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
