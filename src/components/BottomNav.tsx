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

export function BottomNav() {
  const activeTab = useUiStore((s) => s.activeTab)
  const setActiveTab = useUiStore((s) => s.setActiveTab)

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-around h-16 bg-white border-t border-slate-200">
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-0.5 pt-1.5 pb-1 px-3 transition-colors duration-200 active:scale-95 ${
              active ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-[10px] leading-none">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
