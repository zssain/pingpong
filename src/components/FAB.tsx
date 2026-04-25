import { Plus } from 'lucide-react'
import { useUiStore } from '../store/ui'

export function FAB() {
  const setComposeOpen = useUiStore((s) => s.setComposeOpen)

  return (
    <button
      onClick={() => setComposeOpen(true)}
      className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform duration-150"
      aria-label="Compose"
    >
      <Plus size={24} />
    </button>
  )
}
