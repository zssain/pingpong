import { useEffect } from 'react'
import { useMessagesStore } from '../store/messages'
import { MessageCard } from '../components/MessageCard'
import { FAB } from '../components/FAB'
import { AlertTriangle } from 'lucide-react'

export function AlertsScreen() {
  const messages = useMessagesStore((s) => s.messages)
  const loadMessages = useMessagesStore((s) => s.loadMessages)

  useEffect(() => {
    loadMessages('alert')
    const id = setInterval(() => loadMessages('alert'), 2000)
    return () => clearInterval(id)
  }, [loadMessages])

  // Sort by priority desc, then timestamp desc (already sorted by timestamp from store)
  const sorted = [...messages].sort(
    (a, b) => b.priority - a.priority || b.timestamp - a.timestamp,
  )

  return (
    <>
      <div className="p-4 space-y-3">
        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">No active alerts.</p>
          </div>
        ) : (
          sorted.map((msg) => <MessageCard key={msg.id} message={msg} />)
        )}
      </div>
      <FAB />
    </>
  )
}
