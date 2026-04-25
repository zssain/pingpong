import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useIdentityStore } from '../store/identity'

export function PanicWipeModal() {
  const [open, setOpen] = useState(false)
  const [wiping, setWiping] = useState(false)
  const wipe = useIdentityStore((s) => s.wipe)

  // Listen for panic request
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('mesh:panic-request', handler)
    return () => window.removeEventListener('mesh:panic-request', handler)
  }, [])

  // ESC to cancel
  useEffect(() => {
    if (!open || wiping) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, wiping])

  const handleWipe = useCallback(async () => {
    setWiping(true)
    // Brief dramatic pause
    await new Promise((r) => setTimeout(r, 1500))
    await wipe()
    // wipe() calls window.location.reload()
  }, [wipe])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-red-950/20"
        onClick={() => { if (!wiping) setOpen(false) }}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        {wiping ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
            <p className="text-lg font-bold text-red-900">Wiping...</p>
            <p className="text-sm text-red-600 mt-2">
              Destroying all local data
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 text-center">
              Wipe everything?
            </h2>
            <p className="text-sm text-slate-500 text-center mt-2 leading-relaxed">
              This destroys all messages, contacts, and your identity.
              Cannot be undone.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium active:bg-slate-50 transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleWipe}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium active:bg-red-700 transition-colors duration-150"
              >
                Wipe now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
