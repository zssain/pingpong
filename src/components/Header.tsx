import { useRef, useCallback } from 'react'
import { Network } from 'lucide-react'
import { useIdentityStore } from '../store/identity'
import { useUiStore } from '../store/ui'

interface Props {
  onMeshOpen?: () => void
}

export function Header({ onMeshOpen }: Props) {
  const alias = useIdentityStore((s) => s.alias)
  const peerCount = useUiStore((s) => s.peerCount)
  const tapCount = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTap = useCallback(() => {
    tapCount.current++
    if (tapCount.current >= 3) {
      tapCount.current = 0
      if (tapTimer.current) clearTimeout(tapTimer.current)
      window.dispatchEvent(new Event('mesh:panic-request'))
      return
    }
    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0
    }, 600)
  }, [])

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 bg-[#0B3D91] text-white select-none">
      <div className="flex items-center gap-2" onClick={handleTap}>
        <span className="text-sm font-bold tracking-widest">MESH</span>
      </div>
      <span className="text-xs text-blue-200 truncate max-w-[140px]">
        {alias ?? '...'}
      </span>
      <div className="flex items-center gap-3">
        {onMeshOpen && (
          <button
            onClick={onMeshOpen}
            className="p-1 text-blue-200 hover:text-white transition-colors duration-150"
            aria-label="View mesh network"
          >
            <Network size={16} />
          </button>
        )}
        <span className="text-xs text-blue-300">
          {peerCount} peer{peerCount !== 1 ? 's' : ''}
        </span>
      </div>
    </header>
  )
}
