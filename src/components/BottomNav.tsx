import { useRef, useCallback, useEffect } from 'react'
import {
  Newspaper,
  MessageCircle,
  AlertTriangle,
  Wifi,
  Archive,
} from 'lucide-react'
import { useUiStore, type Tab } from '../store/ui'

const tabs: { id: Tab; label: string; icon: typeof Newspaper }[] = [
  { id: 'feed', label: 'Feed', icon: Newspaper },
  { id: 'dms', label: 'DMs', icon: MessageCircle },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'connect', label: 'Connect', icon: Wifi },
  { id: 'drops', label: 'Drops', icon: Archive },
]

const DEMO_MODES: Array<'unknown' | 'lan' | 'offline'> = ['unknown', 'lan', 'offline']

export function BottomNav() {
  const activeTab = useUiStore((s) => s.activeTab)
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const setNetworkMode = useUiStore((s) => s.setNetworkMode)
  const showToast = useUiStore((s) => s.showToast)
  const tapCount = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const demoIndex = useRef(0)

  const cycleDemoMode = useCallback(() => {
    demoIndex.current = (demoIndex.current + 1) % DEMO_MODES.length
    const mode = DEMO_MODES[demoIndex.current]
    setNetworkMode(mode)
    showToast(`Demo: forced network mode → ${mode}`, 2000)
  }, [setNetworkMode, showToast])

  // Listen for demo-cycle events from the settings menu
  useEffect(() => {
    const handler = () => cycleDemoMode()
    window.addEventListener('wisp:demo-cycle', handler)
    return () => window.removeEventListener('wisp:demo-cycle', handler)
  }, [cycleDemoMode])

  const handleConnectTap = useCallback(() => {
    tapCount.current++
    if (tapCount.current >= 3) {
      tapCount.current = 0
      if (tapTimer.current) clearTimeout(tapTimer.current)
      demoIndex.current = (demoIndex.current + 1) % DEMO_MODES.length
      const mode = DEMO_MODES[demoIndex.current]
      setNetworkMode(mode)
      showToast(`Demo: forced network mode → ${mode}`, 2000)
      return
    }
    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0
    }, 500)
  }, [setNetworkMode, showToast])

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-surface/80 backdrop-blur-md border border-border-mid px-4 py-2.5 rounded-full shadow-[0_0_24px_rgba(212,165,116,0.06)]">
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            onClick={() => {
              setActiveTab(id)
              if (id === 'connect') handleConnectTap()
            }}
            className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-all duration-200 active:scale-[0.92] ${
              active ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text'
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2 : 1.5} />
            <span className="hidden min-[360px]:block text-[9px] font-mono uppercase tracking-wider leading-none">
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
