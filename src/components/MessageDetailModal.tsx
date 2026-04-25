import { useEffect, useState, useCallback } from 'react'
import { X, MapPin, Clock, Globe } from 'lucide-react'
import { useUiStore } from '../store/ui'
import { getMessage } from '../db'
import { HopChain } from './HopChain'
import { timeAgo } from '../lib/timeago'
import type { Message } from '../types'

const TYPE_LABELS: Record<Message['type'], { text: string; className: string }> = {
  news: { text: 'News', className: 'bg-slate-100 text-slate-600' },
  alert: { text: 'Alert', className: 'bg-red-50 text-red-600' },
  dm: { text: 'DM', className: 'bg-blue-50 text-blue-600' },
  drop: { text: 'Drop', className: 'bg-amber-50 text-amber-600' },
}

export function MessageDetailModal() {
  const detailMessageId = useUiStore((s) => s.detailMessageId)
  const closeDetail = useUiStore((s) => s.closeDetail)
  const [message, setMessage] = useState<Message | null>(null)

  const isOpen = detailMessageId !== null

  useEffect(() => {
    if (detailMessageId) {
      getMessage(detailMessageId).then((m) => setMessage(m ?? null))
    } else {
      setMessage(null)
    }
  }, [detailMessageId])

  // ESC to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetail()
    },
    [closeDetail],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  const badge = message ? TYPE_LABELS[message.type] : null
  const ttlRemaining = message
    ? Math.max(0, message.ttl - Date.now())
    : 0
  const ttlHours = Math.floor(ttlRemaining / (1000 * 60 * 60))
  const ttlMinutes = Math.floor((ttlRemaining % (1000 * 60 * 60)) / (1000 * 60))

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeDetail}
      />

      {/* Panel */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-w-lg mx-auto max-h-[85vh] flex flex-col transition-transform duration-200 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {message && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
              {badge && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${badge.className}`}
                >
                  {badge.text}
                </span>
              )}
              <button
                onClick={closeDetail}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors duration-150"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto p-4 space-y-4">
              {/* Hidden / replaced banner */}
              {message.hidden && (
                <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  This message has been replaced by a newer version.
                </div>
              )}

              {/* Content */}
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {message.content}
              </p>

              {/* Location */}
              {message.location && (
                <div className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  <MapPin size={14} className="shrink-0" />
                  <span className="font-medium">{message.location}</span>
                </div>
              )}

              {/* Chain of custody */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Chain of custody
                </h4>
                <HopChain
                  messageId={message.id}
                  hops={message.hops}
                  authorPubkey={message.authorPubkey}
                  authorAlias={message.authorAlias}
                />
              </div>

              {/* Metadata */}
              <div className="border-t border-slate-100 pt-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock size={12} />
                  <span>
                    Created {timeAgo(message.timestamp)} &middot; Expires in{' '}
                    {ttlHours > 0 ? `${ttlHours}h ` : ''}
                    {ttlMinutes}m
                  </span>
                </div>
                {message.zone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Globe size={12} />
                    <span>Zone: {message.zone}</span>
                  </div>
                )}
                <div className="text-[10px] text-slate-300 font-mono truncate">
                  ID: {message.id}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
