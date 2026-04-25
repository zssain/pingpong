import { Plus } from 'lucide-react'
import { useUiStore } from '../store/ui'

export function FAB() {
  const setComposeOpen = useUiStore((s) => s.setComposeOpen)

  return (
    <button
      onClick={() => setComposeOpen(true)}
      className="fixed bottom-20 right-4 z-40 w-12 h-12 bg-surface-2 border border-accent-dim text-accent flex items-center justify-center hover:bg-accent-glow hover:border-accent active:scale-[0.95] transition-all duration-150"
      aria-label="Compose"
    >
      <Plus size={18} />
    </button>
  )
}
