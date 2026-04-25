import { useEffect, useState } from 'react'
import { useMessagesStore } from '../store/messages'
import { MessageCard } from '../components/MessageCard'
import { FAB } from '../components/FAB'
import { ZoneFilter } from '../components/ZoneFilter'
import { AlertTriangle } from 'lucide-react'
import type { Zone } from '../lib/zones'

export function AlertsScreen() {
  const messages = useMessagesStore((s) => s.messages)
  const loadMessages = useMessagesStore((s) => s.loadMessages)
  const recentlyArrivedIds = useMessagesStore((s) => s.recentlyArrivedIds)
  const [zone, setZone] = useState<Zone>('all')

  useEffect(() => {
    loadMessages('alert')
    const id = setInterval(() => loadMessages('alert'), 2000)
    return () => clearInterval(id)
  }, [loadMessages])

  const filtered = zone === 'all'
    ? messages
    : messages.filter((m) => m.zone === zone || !m.zone)

  const sorted = [...filtered].sort(
    (a, b) => b.priority - a.priority || b.timestamp - a.timestamp,
  )

  return (
    <>
      <div className="p-4 space-y-3">
        <ZoneFilter selected={zone} onChange={setZone} />

        {sorted.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <AlertTriangle size={28} className="mx-auto text-text-dim" />
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-dim">
              NO ACTIVE ALERTS
            </div>
          </div>
        ) : (
          sorted.map((msg, i) => <MessageCard key={msg.id} message={msg} index={i} isNew={recentlyArrivedIds.has(msg.id)} />)
        )}
      </div>
      <FAB />
    </>
  )
}
