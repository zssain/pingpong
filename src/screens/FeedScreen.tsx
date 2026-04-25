import { useEffect, useState } from 'react'
import { useMessagesStore } from '../store/messages'
import { MessageCard } from '../components/MessageCard'
import { FAB } from '../components/FAB'
import { ZoneFilter } from '../components/ZoneFilter'
import type { Zone } from '../lib/zones'

export function FeedScreen() {
  const messages = useMessagesStore((s) => s.messages)
  const loadMessages = useMessagesStore((s) => s.loadMessages)
  const [zone, setZone] = useState<Zone>('all')

  useEffect(() => {
    loadMessages('news')
    const id = setInterval(() => loadMessages('news'), 2000)
    return () => clearInterval(id)
  }, [loadMessages])

  const filtered = zone === 'all'
    ? messages
    : messages.filter((m) => m.zone === zone || !m.zone)

  return (
    <>
      <div className="p-4 space-y-3">
        <ZoneFilter selected={zone} onChange={setZone} />

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-slate-400">
              No posts yet. Tap the + to share something.
            </p>
          </div>
        ) : (
          filtered.map((msg, i) => <MessageCard key={msg.id} message={msg} index={i} />)
        )}
      </div>
      <FAB />
    </>
  )
}
