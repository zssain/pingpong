import { useEffect, useState, useCallback } from 'react'
import { X, MapPin, Clock, Globe, Pencil } from 'lucide-react'
import { useUiStore } from '../store/ui'
import { useIdentityStore } from '../store/identity'
import { getMessage } from '../db'
import { HopChain } from './HopChain'
import { ComposeModal } from './ComposeModal'
import { timeAgo } from '../lib/timeago'
import type { Message } from '../types'

const TYPE_LABELS: Record<Message['type'], { text: string; className: string }> = {
  news: { text: 'NEWS', className: 'border border-border text-text-muted' },
  alert: { text: 'ALERT', className: 'border border-alert text-alert' },
  dm: { text: 'DM', className: 'border border-accent-dim text-accent' },
  drop: { text: 'DROP', className: 'border border-accent-dim text-accent' },
}

export function MessageDetailModal() {
  const detailMessageId = useUiStore((s) => s.detailMessageId)
  const closeDetail = useUiStore((s) => s.closeDetail)
  const myPubkey = useIdentityStore((s) => s.pubkey)
  const [message, setMessage] = useState<Message | null>(null)
  const [editing, setEditing] = useState(false)

  const isOpen = detailMessageId !== null

  useEffect(() => {
    if (detailMessageId) {
      getMessage(detailMessageId).then((m) => setMessage(m ?? null))
    } else {
      setMessage(null)
      setEditing(false)
    }
  }, [detailMessageId])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') closeDetail() },
    [closeDetail],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  const badge = message ? TYPE_LABELS[message.type] : null
  const ttlRemaining = message ? Math.max(0, message.ttl - Date.now()) : 0
  const ttlHours = Math.floor(ttlRemaining / (1000 * 60 * 60))
  const ttlMinutes = Math.floor((ttlRemaining % (1000 * 60 * 60)) / (1000 * 60))

  const canEdit =
    message &&
    message.authorPubkey === myPubkey &&
    !!message.signature &&
    !message.hidden

  return (
    <>
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeDetail}
      >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-lg max-h-[85vh] flex flex-col bg-surface border border-border-mid transition-all duration-200 ease-out ${
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {message && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                {badge && (
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 ${badge.className}`}>
                    {badge.text}
                  </span>
                )}
                {canEdit && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-text-muted hover:text-accent border border-border hover:border-accent-dim px-2 py-0.5 transition-colors duration-150"
                  >
                    <Pencil size={10} />
                    EDIT
                  </button>
                )}
              </div>
              <button
                onClick={closeDetail}
                className="p-1 text-text-muted hover:text-text transition-colors duration-150"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto p-4 space-y-4">
              {/* Status banners */}
              {message.hidden && (
                <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted border-l-2 border-text-dim pl-3 py-1">
                  THIS POST WAS REPLACED BY A NEWER VERSION
                </div>
              )}
              {message.replaces && !message.hidden && (
                <div className="text-[11px] font-mono uppercase tracking-wider text-accent border-l-2 border-accent pl-3 py-1">
                  UPDATED VERSION OF AN EARLIER POST
                </div>
              )}

              {/* Content */}
              <p className="text-[15px] font-body text-text whitespace-pre-wrap leading-relaxed">
                {message.content}
              </p>

              {/* Location */}
              {message.location && (
                <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-alert border border-alert/40 px-3 py-2">
                  <MapPin size={12} className="shrink-0" />
                  <span>{message.location}</span>
                </div>
              )}

              {/* Chain of custody */}
              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-3">
                  CHAIN OF CUSTODY
                </h4>
                <HopChain
                  messageId={message.id}
                  hops={message.hops}
                  authorPubkey={message.authorPubkey}
                  authorAlias={message.authorAlias}
                />
              </div>

              {/* Metadata */}
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                  <Clock size={12} />
                  <span>
                    CREATED {timeAgo(message.timestamp).toUpperCase()} &middot; EXPIRES IN{' '}
                    {ttlHours > 0 ? `${ttlHours}H ` : ''}{ttlMinutes}M
                  </span>
                </div>
                {message.zone && (
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                    <Globe size={12} />
                    <span>ZONE: {message.zone.toUpperCase()}</span>
                  </div>
                )}
                <div className="text-[9px] font-mono text-text-dim truncate">
                  ID: {message.id}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      </div>

      {/* Edit compose modal */}
      {editing && message && (
        <ComposeModal
          replaceMessageId={message.id}
          onCloseReplace={() => {
            setEditing(false)
            closeDetail()
          }}
        />
      )}
    </>
  )
}
