import { CheckCircle, Ghost, MapPin, Pencil } from 'lucide-react'
import type { Message } from '../types'
import { timeAgo } from '../lib/timeago'
import { useUiStore } from '../store/ui'

interface Props {
  message: Message
  index?: number
  isNew?: boolean
}

export function MessageCard({ message, index = 0, isNew = false }: Props) {
  const openDetail = useUiStore((s) => s.openDetail)

  const isSigned = !!message.authorPubkey && !!message.signature
  const isAlert = message.type === 'alert'
  const isEdited = !!message.replaces

  return (
    <div
      onClick={() => openDetail(message.id)}
      style={{
        animationDelay: `${index * 50}ms, ${((index * 1.7) % 8).toFixed(1)}s`,
        transition: 'border-color 1500ms ease-out, box-shadow 1500ms ease-out',
      }}
      className={[
        'relative bg-surface border p-4 cursor-pointer',
        'transition-all duration-300',
        'hover:border-border-mid hover:bg-accent-glow',
        'animate-card-in animate-subtle-breath',
        isAlert ? 'border-l-2 border-l-alert' : '',
        isNew
          ? 'border-accent shadow-[0_0_0_1px] shadow-accent/40'
          : 'border-border',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {isSigned ? (
            <>
              <CheckCircle size={11} className="text-accent shrink-0" />
              <span className="text-xs font-mono text-text truncate">
                {message.authorAlias}
              </span>
            </>
          ) : (
            <>
              <Ghost size={11} className="text-text-dim shrink-0" />
              <span className="text-xs font-mono text-text-muted italic">anonymous</span>
            </>
          )}
          {isEdited && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono uppercase tracking-wider text-text-dim ml-2">
              <Pencil size={9} />
              edited
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim shrink-0 ml-2">
          {timeAgo(message.timestamp)}
        </span>
      </div>

      {/* Body */}
      <p className="mt-2 text-sm font-body text-text whitespace-pre-wrap line-clamp-4 leading-relaxed">
        {message.content}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-3 mt-2">
        {message.hops.length > 0 && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
            VIA {message.hops.length} DEVICE{message.hops.length !== 1 ? 'S' : ''}
          </span>
        )}
        {isAlert && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-alert border border-alert/40 px-1.5 py-0.5">
            ALERT
          </span>
        )}
        {message.type === 'drop' && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-accent border border-accent-dim px-1.5 py-0.5">
            DROP
          </span>
        )}
        {message.location && (
          <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-text-muted">
            <MapPin size={9} />
            {message.location}
          </span>
        )}
      </div>
    </div>
  )
}
