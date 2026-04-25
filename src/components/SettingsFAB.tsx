import { useState, useEffect } from 'react'
import { Settings, X, QrCode, Network, Info, Trash2, Sparkles } from 'lucide-react'

type Item = {
  label: string
  Icon: typeof Settings
  onClick: () => void
  danger?: boolean
}

interface Props {
  onMeshOpen?: () => void
  onMyHandleOpen?: () => void
  onAboutOpen?: () => void
}

export function SettingsFAB({ onMeshOpen, onMyHandleOpen, onAboutOpen }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  const handleAction = (fn: () => void) => {
    setIsOpen(false)
    setTimeout(fn, 50)
  }

  const items: Item[] = [
    { label: 'MY HANDLE', Icon: QrCode, onClick: () => onMyHandleOpen?.() },
    { label: 'VIEW MESH', Icon: Network, onClick: () => onMeshOpen?.() },
    { label: 'DEMO MODE', Icon: Sparkles, onClick: () => window.dispatchEvent(new CustomEvent('wisp:demo-cycle')) },
    { label: 'ABOUT', Icon: Info, onClick: () => onAboutOpen?.() },
    { label: 'WIPE IDENTITY', Icon: Trash2, onClick: () => window.dispatchEvent(new CustomEvent('mesh:panic-request')), danger: true },
  ]

  return (
    <div className="fixed top-3 right-3 z-40">
      {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 z-[-1]" aria-hidden />}

      <button
        onClick={() => setIsOpen((p) => !p)}
        aria-label={isOpen ? 'Close settings' : 'Open settings'}
        aria-expanded={isOpen}
        className={`w-10 h-10 flex items-center justify-center border transition-all duration-200 active:scale-[0.92] ${
          isOpen
            ? 'bg-accent/10 border-accent text-accent rotate-45'
            : 'bg-surface-2 border-border text-text-muted hover:border-accent-dim hover:text-accent'
        }`}
      >
        {isOpen ? <X size={18} className="-rotate-45" strokeWidth={1.8} /> : <Settings size={16} strokeWidth={1.5} />}
      </button>

      <div className={`absolute top-12 right-0 flex flex-col items-end gap-1.5 transition-all duration-200 ${
        isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'
      }`}>
        {items.map((item, index) => {
          const Icon = item.Icon
          return (
            <button
              key={item.label}
              onClick={() => handleAction(item.onClick)}
              style={{ transitionDelay: isOpen ? `${50 + index * 40}ms` : '0ms' }}
              className={`flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.15em] border transition-all duration-200 active:scale-[0.95] ${
                item.danger
                  ? 'bg-surface border-border text-text-muted hover:border-alert hover:text-alert'
                  : 'bg-surface border-border text-text-muted hover:border-accent-dim hover:text-accent hover:bg-accent-glow'
              } ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
