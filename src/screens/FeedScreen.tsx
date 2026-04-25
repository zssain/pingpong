import { useEffect } from 'react'
import { useMessagesStore } from '../store/messages'
import { MessageCard } from '../components/MessageCard'
import { FAB } from '../components/FAB'

export function FeedScreen() {
  const messages = useMessagesStore((s) => s.messages)
  const loadMessages = useMessagesStore((s) => s.loadMessages)

  useEffect(() => {
    loadMessages('news')
    const id = setInterval(() => loadMessages('news'), 2000)
    return () => clearInterval(id)
  }, [loadMessages])

  return (
    <>
      <div className="p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-slate-400">
              No posts yet. Tap the + to share something.
            </p>
          </div>
        ) : (
          messages.map((msg) => <MessageCard key={msg.id} message={msg} />)
        )}
      </div>
      <FAB />
    </>
  )
}
