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
    <header className="sticky top-0 z-50 flex items-center h-12 px-4 bg-bg border-b border-border text-text">
      {/* Left: wordmark + alias */}
      <div
        className="flex items-center gap-2 select-none cursor-pointer"
        onClick={handleTap}
      >
        <div className="w-1.5 h-1.5 bg-accent" />
        <span className="text-xs uppercase tracking-[0.2em] font-mono text-text">
          WISP
        </span>
        <span className="text-[11px] font-mono text-text-muted ml-3 truncate max-w-[140px]">
          {alias ?? '...'}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: peer status + mesh icon */}
      <div className="flex items-center">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            peerCount > 0 ? 'bg-success' : 'bg-text-dim'
          }`}
        />
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted ml-2">
          {peerCount} {peerCount === 1 ? 'PEER' : 'PEERS'}
        </span>
        {onMeshOpen && (
          <button
            onClick={onMeshOpen}
            className="ml-3 p-1 text-text-muted hover:text-accent transition-colors duration-150"
            aria-label="View network"
          >
            <Network size={14} />
          </button>
        )}
      </div>
    </header>
  )
}
