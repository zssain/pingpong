import { useRef, useCallback } from 'react'
import { useIdentityStore } from '../store/identity'

export function Header() {
  const alias = useIdentityStore((s) => s.alias)
  const tapCount = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTap = useCallback(() => {
    tapCount.current++
    if (tapCount.current >= 3) {
      tapCount.current = 0
      if (tapTimer.current) clearTimeout(tapTimer.current)
      window.dispatchEvent(new Event('triple-tap'))
      return
    }
    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0
    }, 500)
  }, [])

  return (
    <header
      onClick={handleTap}
      className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 bg-[#0B3D91] text-white select-none"
    >
      <span className="text-sm font-bold tracking-widest">MESH</span>
      <span className="text-xs text-blue-200 truncate max-w-[180px]">
        {alias ?? '...'}
      </span>
      <span className="text-xs text-blue-300">0 peers</span>
    </header>
  )
}
