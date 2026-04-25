import { CheckCircle, Ghost, MapPin, Pencil } from 'lucide-react'
import type { Message } from '../types'
import { timeAgo } from '../lib/timeago'
import { useUiStore } from '../store/ui'

export function MessageCard({ message }: { message: Message }) {
  const openDetail = useUiStore((s) => s.openDetail)

  const isSigned = !!message.authorPubkey && !!message.signature
  const isAlert = message.type === 'alert'
  const isEdited = !!message.replaces

  return (
    <div
      onClick={() => openDetail(message.id)}
      className={`rounded-lg border bg-white p-3 animate-card-in cursor-pointer active:bg-slate-50 transition-colors duration-150 ${
        isAlert ? 'border-l-4 border-l-red-500 border-slate-200' : 'border-slate-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {isSigned ? (
            <>
              <CheckCircle size={14} className="text-blue-500 shrink-0" />
              <span className="text-sm font-medium text-slate-700 truncate">
                {message.authorAlias}
              </span>
            </>
          ) : (
            <>
              <Ghost size={14} className="text-slate-400 shrink-0" />
              <span className="text-sm text-slate-400 italic">anonymous</span>
            </>
          )}
          {isEdited && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
              <Pencil size={10} />
              edited
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 shrink-0 ml-2">
          {timeAgo(message.timestamp)}
        </span>
      </div>

      {/* Body */}
      <p className="text-sm text-slate-800 whitespace-pre-wrap line-clamp-4">
        {message.content}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-2 mt-2">
        {message.hops.length > 0 && (
          <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
            via {message.hops.length} device{message.hops.length !== 1 ? 's' : ''}
          </span>
        )}
        {isAlert && (
          <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
            ALERT
          </span>
        )}
        {message.type === 'drop' && (
          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
            DROP
          </span>
        )}
        {message.location && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
            <MapPin size={10} />
            {message.location}
          </span>
        )}
      </div>
    </div>
  )
}
