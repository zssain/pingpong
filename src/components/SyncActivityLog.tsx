import { useSyncStore, type SyncEvent } from '../store/sync'
import { ArrowUp, ArrowDown, Link, Unlink, CheckCircle } from 'lucide-react'

function eventIcon(kind: SyncEvent['kind']) {
  switch (kind) {
    case 'peer-connected':
      return <Link size={12} className="text-green-500" />
    case 'peer-disconnected':
      return <Unlink size={12} className="text-slate-400" />
    case 'msg-sent':
      return <ArrowUp size={12} className="text-blue-500" />
    case 'msg-received':
      return <ArrowDown size={12} className="text-emerald-500" />
    case 'sync-complete':
      return <CheckCircle size={12} className="text-green-500" />
  }
}

function eventText(e: SyncEvent): string {
  switch (e.kind) {
    case 'peer-connected':
      return `Connected to ${e.peerAlias ?? 'peer'}`
    case 'peer-disconnected':
      return `${e.peerAlias ?? 'Peer'} disconnected`
    case 'msg-sent':
      return `Sent message ${e.messageId?.slice(0, 8) ?? ''}…`
    case 'msg-received':
      return `Received message ${e.messageId?.slice(0, 8) ?? ''}…`
    case 'sync-complete':
      return `Sync complete${e.peerAlias ? ` with ${e.peerAlias}` : ''}`
  }
}

function timeStr(t: number): string {
  return new Date(t).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function SyncActivityLog() {
  const events = useSyncStore((s) => s.events)
  const recent = events.slice(0, 10)

  if (recent.length === 0) return null

  return (
    <div className="w-full max-w-sm mt-6">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Activity
      </h4>
      <div className="space-y-1">
        {recent.map((e, i) => (
          <div
            key={`${e.t}-${i}`}
            className="flex items-center gap-2 text-xs text-slate-600 py-1 animate-fade-in"
          >
            {eventIcon(e.kind)}
            <span className="flex-1 truncate">{eventText(e)}</span>
            <span className="text-slate-400 shrink-0">{timeStr(e.t)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
