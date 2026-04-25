import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useUiStore } from '../store/ui'
import { useMessagesStore } from '../store/messages'
import { createLocalMessage } from '../lib/createMessage'
import { getMessage } from '../db'
import { ZONES, ALERT_CATEGORIES, type Zone, type AlertCategory } from '../lib/zones'

const MAX_CHARS = 280

type PostType = 'news' | 'alert' | 'drop'

interface Props {
  replaceMessageId?: string | null
  onCloseReplace?: () => void
}

export function ComposeModal({ replaceMessageId, onCloseReplace }: Props = {}) {
  const composeOpen = useUiStore((s) => s.composeOpen)
  const setComposeOpen = useUiStore((s) => s.setComposeOpen)
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const addLocalMessage = useMessagesStore((s) => s.addLocalMessage)

  const [type, setType] = useState<PostType>('news')
  const [content, setContent] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [location, setLocation] = useState('')
  const [zone, setZone] = useState<Zone>('all')
  const [alertCategory, setAlertCategory] = useState<AlertCategory>('medical')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isReplacing = !!replaceMessageId
  const isOpen = isReplacing || composeOpen

  useEffect(() => {
    if (replaceMessageId) {
      getMessage(replaceMessageId).then((msg) => {
        if (msg) {
          setType(msg.type as PostType)
          setContent(msg.content)
          if (msg.location) setLocation(msg.location)
        }
      })
    }
  }, [replaceMessageId])

  const isAlert = type === 'alert'
  const canBeAnonymous = type !== 'alert' && !isReplacing
  const isValid =
    content.trim().length > 0 &&
    content.length <= MAX_CHARS &&
    (!isAlert || location.trim().length > 0)

  function close() {
    if (isReplacing) {
      onCloseReplace?.()
    } else {
      setComposeOpen(false)
    }
    setContent('')
    setAnonymous(false)
    setLocation('')
    setType('news')
    setZone('all')
    setAlertCategory('medical')
    setError(null)
  }

  async function handlePost() {
    if (!isValid || posting) return
    setPosting(true)
    setError(null)

    try {
      const msg = await createLocalMessage({
        type,
        content: content.trim(),
        anonymous: canBeAnonymous ? anonymous : false,
        location: isAlert ? location.trim() : undefined,
        replaces: replaceMessageId ?? undefined,
        zone,
        alertCategory: isAlert ? alertCategory : undefined,
      })
      await addLocalMessage(msg)
      if (!isReplacing) {
        setActiveTab(isAlert ? 'alerts' : 'feed')
      }
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm transition-opacity duration-200 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md max-h-[85vh] flex flex-col bg-surface border border-border-mid transition-all duration-200 ease-out ${
          isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0 shrink-0">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted">
            {isReplacing ? 'EDIT POST' : 'NEW POST'}
          </h3>
          <button
            onClick={close}
            className="p-1 text-text-muted hover:text-text transition-colors duration-150"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="p-5 pt-4 overflow-y-auto flex-1">

          {/* Replace banner */}
          {isReplacing && (
            <div className="text-[11px] font-mono uppercase tracking-wider text-accent border border-accent-dim px-3 py-2 mb-3">
              EDITING — PREVIOUS VERSION WILL BE REPLACED
            </div>
          )}

          {/* Type selector */}
          {!isReplacing && (
            <div className="flex gap-2 mb-3">
              {(['news', 'alert', 'drop'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setType(t)
                    if (t === 'alert') setAnonymous(false)
                  }}
                  className={`flex-1 px-3 py-2 text-[11px] font-mono uppercase tracking-wider border transition-colors duration-150 ${
                    type === t
                      ? t === 'alert'
                        ? 'border-alert text-alert bg-alert/5'
                        : 'border-accent text-accent bg-accent-glow'
                      : 'border-border text-text-muted hover:border-border-mid'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Anonymous checkbox */}
          {canBeAnonymous && (
            <label className="flex items-center gap-2 mb-3 cursor-pointer text-[11px] font-mono uppercase tracking-wider text-text-muted">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="border border-border bg-surface-2 text-accent focus:ring-1 focus:ring-accent w-3.5 h-3.5"
              />
              POST ANONYMOUSLY
            </label>
          )}

          {/* Zone selector */}
          {!isReplacing && (
            <div className="mb-3">
              <label className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2 block">ZONE</label>
              <div className="flex gap-1.5 flex-wrap">
                {ZONES.map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZone(z)}
                    className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider border transition-colors duration-150 ${
                      zone === z
                        ? 'border-accent text-accent bg-accent-glow'
                        : 'border-border text-text-muted hover:border-border-mid'
                    }`}
                  >
                    {z.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Alert category */}
          {isAlert && (
            <div className="mb-3">
              <label className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2 block">CATEGORY</label>
              <div className="flex gap-1.5 flex-wrap">
                {ALERT_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAlertCategory(c)}
                    className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider border transition-colors duration-150 ${
                      alertCategory === c
                        ? 'border-alert text-alert bg-alert/5'
                        : 'border-border text-text-muted hover:border-border-mid'
                    }`}
                  >
                    {c.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location input */}
          {isAlert && (
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (e.g. Central Clinic, Main Road)"
              className="w-full px-3 py-2.5 mb-3 text-sm font-body bg-surface-2 border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors duration-150"
            />
          )}

          {/* Textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            placeholder={isAlert ? 'Describe the emergency...' : "What's happening in your area?"}
            rows={3}
            className="w-full px-3 py-2.5 text-sm font-body bg-surface-2 border border-border text-text placeholder:text-text-dim resize-none focus:outline-none focus:border-accent transition-colors duration-150"
          />

          {/* Char counter */}
          <div className="flex items-center justify-between mt-1 mb-2">
            <span className={`text-[10px] font-mono uppercase tracking-wider ${content.length > MAX_CHARS - 20 ? 'text-alert' : 'text-text-dim'}`}>
              {content.length}/{MAX_CHARS}
            </span>
            {error && <span className="text-[10px] font-mono uppercase tracking-wider text-alert">{error}</span>}
          </div>

        </div>

        {/* Fixed footer with submit button */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <button
            onClick={handlePost}
            disabled={!isValid || posting}
            className={`w-full py-2.5 text-xs font-mono uppercase tracking-[0.2em] border transition-all duration-150 active:scale-[0.98] ${
              isValid && !posting
                ? isAlert
                  ? 'bg-alert/10 border-alert text-alert hover:bg-alert/20'
                  : 'bg-accent/10 border-accent text-accent hover:bg-accent/20'
                : 'bg-surface border-border text-text-dim cursor-not-allowed'
            }`}
          >
            {posting ? 'POSTING...' : isReplacing ? 'UPDATE' : isAlert ? 'POST ALERT' : 'POST'}
          </button>
        </div>
      </div>
    </div>
  )
}
