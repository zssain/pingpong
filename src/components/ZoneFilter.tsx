import { ZONES, type Zone } from '../lib/zones'

interface Props {
  selected: Zone
  onChange: (zone: Zone) => void
}

export function ZoneFilter({ selected, onChange }: Props) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {ZONES.map((z) => (
        <button
          key={z}
          onClick={() => onChange(z)}
          className={`px-3 py-1 text-[11px] font-mono uppercase tracking-wider border whitespace-nowrap transition-colors duration-150 ${
            selected === z
              ? 'border-accent text-accent bg-accent-glow'
              : 'border-border text-text-muted hover:border-border-mid'
          }`}
        >
          {z.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
