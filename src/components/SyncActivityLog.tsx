import { useSyncStore, type SyncEvent } from '../store/sync'
import { ArrowUp, ArrowDown, Link, Unlink, CheckCircle } from 'lucide-react'

function eventIcon(kind: SyncEvent['kind']) {
  switch (kind) {
    case 'peer-connected':
      return <Link size={10} className="text-success" />
    case 'peer-disconnected':
      return <Unlink size={10} className="text-text-dim" />
    case 'msg-sent':
      return <ArrowUp size={10} className="text-accent" />
    case 'msg-received':
      return <ArrowDown size={10} className="text-success" />
    case 'sync-complete':
      return <CheckCircle size={10} className="text-success" />
  }
}

function eventText(e: SyncEvent): string {
  switch (e.kind) {
    case 'peer-connected':
      return `Connected to ${e.peerAlias ?? 'peer'}`
    case 'peer-disconnected':
      return `${e.peerAlias ?? 'Peer'} disconnected`
    case 'msg-sent':
      return `Sent ${e.messageId?.slice(0, 8) ?? ''}…`
    case 'msg-received':
      return `Received ${e.messageId?.slice(0, 8) ?? ''}…`
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
    <div className="w-full max-w-sm border-t border-border pt-3 mt-4 space-y-1">
      <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-dim mb-2">
        ACTIVITY
      </h4>
      <div className="space-y-1">
        {recent.map((e, i) => (
          <div
            key={`${e.t}-${i}`}
            className="flex items-center gap-2 text-[10px] font-mono text-text-muted py-0.5 animate-fade-in"
          >
            {eventIcon(e.kind)}
            <span className="flex-1 truncate">{eventText(e)}</span>
            <span className="text-text-dim shrink-0">{timeStr(e.t)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
