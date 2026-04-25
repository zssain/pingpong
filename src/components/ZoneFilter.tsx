import { ZONES, type Zone } from '../lib/zones'

interface Props {
  selected: Zone
  onChange: (zone: Zone) => void
}

export function ZoneFilter({ selected, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
      {ZONES.map((z) => (
        <button
          key={z}
          onClick={() => onChange(z)}
          className={`px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-colors duration-150 ${
            selected === z
              ? 'bg-slate-900 border-slate-900 text-white'
              : 'border-slate-200 text-slate-500 active:bg-slate-50'
          }`}
        >
          {z.charAt(0).toUpperCase() + z.slice(1)}
        </button>
      ))}
    </div>
  )
}
