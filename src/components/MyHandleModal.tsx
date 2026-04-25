import { useEffect } from 'react'
import { X } from 'lucide-react'
import { QRDisplay } from './QRDisplay'
import { useIdentityStore } from '../store/identity'
import { pubkeyToHandle } from '../lib/handle'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function MyHandleModal({ isOpen, onClose }: Props) {
  const pubkey = useIdentityStore((s) => s.pubkey)
  const alias = useIdentityStore((s) => s.alias)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen || !pubkey) return null

  const handle = pubkeyToHandle(pubkey)

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm bg-surface border border-border-mid p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted">MY HANDLE</span>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text transition-colors duration-150" aria-label="Close">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 py-2">
          <QRDisplay text={pubkey} />
          <div className="text-center space-y-1">
            <p className="text-base font-mono text-accent tracking-wider">{handle}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">{alias}</p>
          </div>
        </div>

        <p className="text-[11px] font-mono text-text-muted text-center leading-relaxed">
          Others scan this to add you as a contact for direct messages.
        </p>
      </div>
    </div>
  )
}
