import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useIdentityStore } from '../store/identity'

export function PanicWipeModal() {
  const [open, setOpen] = useState(false)
  const [wiping, setWiping] = useState(false)
  const wipe = useIdentityStore((s) => s.wipe)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('mesh:panic-request', handler)
    return () => window.removeEventListener('mesh:panic-request', handler)
  }, [])

  useEffect(() => {
    if (!open || wiping) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, wiping])

  const handleWipe = useCallback(async () => {
    setWiping(true)
    await new Promise((r) => setTimeout(r, 1500))
    await wipe()
  }, [wipe])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-bg/95 backdrop-blur-md" onClick={() => { if (!wiping) setOpen(false) }} />
      <div className="relative bg-surface border border-alert max-w-sm w-full mx-4 overflow-hidden">
        {wiping ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-5 border-2 border-alert flex items-center justify-center animate-pulse">
              <AlertTriangle size={28} className="text-alert" />
            </div>
            <p className="text-base font-mono uppercase tracking-[0.2em] text-alert">WIPING</p>
            <p className="text-xs font-mono text-text-muted mt-2">Destroying all local data</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="w-12 h-12 mx-auto mb-5 border border-alert flex items-center justify-center">
              <AlertTriangle size={24} className="text-alert" />
            </div>
            <h2 className="text-lg font-mono uppercase tracking-[0.2em] text-text text-center">WIPE EVERYTHING?</h2>
            <p className="text-xs font-mono text-text-muted text-center mt-3 leading-relaxed">
              Destroys all messages, contacts, and identity. Cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setOpen(false)} className="flex-1 py-2.5 text-[11px] font-mono uppercase tracking-[0.2em] border border-border text-text-muted hover:text-text transition-colors duration-150">
                CANCEL
              </button>
              <button onClick={handleWipe} className="flex-1 py-2.5 text-[11px] font-mono uppercase tracking-[0.2em] border border-alert text-alert bg-alert/10 hover:bg-alert/20 transition-all duration-150 active:scale-[0.98]">
                WIPE NOW
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
