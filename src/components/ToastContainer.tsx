import { X } from 'lucide-react'
import { useUiStore } from '../store/ui'

export function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts)
  const dismissToast = useUiStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-14 inset-x-0 z-40 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 bg-surface border border-accent-dim text-text text-xs font-mono px-3 py-2 animate-fade-in max-w-sm w-full"
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="text-text-dim hover:text-text transition-colors duration-150">
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
