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

  // Pre-fill when editing
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
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
      />

      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-w-md mx-auto transition-transform duration-200 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              {isReplacing ? 'Edit post' : 'New post'}
            </h3>
            <button
              onClick={close}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors duration-150"
            >
              <X size={20} />
            </button>
          </div>

          {/* Replace banner */}
          {isReplacing && (
            <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg mb-3">
              Editing your post. Previous version will be replaced in the mesh.
            </div>
          )}

          {/* Type selector — disabled when replacing */}
          {!isReplacing && (
            <div className="flex gap-2 mb-3">
              {(['news', 'alert', 'drop'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setType(t)
                    if (t === 'alert') setAnonymous(false)
                  }}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors duration-150 ${
                    type === t
                      ? t === 'alert'
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-slate-900 border-slate-900 text-white'
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}

          {canBeAnonymous && (
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              <span className="text-sm text-slate-600">Post anonymously</span>
            </label>
          )}

          {/* Zone selector */}
          {!isReplacing && (
            <div className="mb-3">
              <label className="text-xs text-slate-500 mb-1 block">Zone</label>
              <div className="flex gap-1.5 flex-wrap">
                {ZONES.map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZone(z)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors duration-150 ${
                      zone === z
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {z.charAt(0).toUpperCase() + z.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Alert category */}
          {isAlert && (
            <div className="mb-3">
              <label className="text-xs text-slate-500 mb-1 block">Category</label>
              <div className="flex gap-1.5 flex-wrap">
                {ALERT_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAlertCategory(c)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors duration-150 ${
                      alertCategory === c
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isAlert && (
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (e.g. Central Clinic, Main Road)"
              className="w-full px-3 py-2 mb-3 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            placeholder={isAlert ? 'Describe the emergency...' : "What's happening in your area?"}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
          />

          <div className="flex items-center justify-between mt-1 mb-3">
            <span className={`text-xs ${content.length > MAX_CHARS - 20 ? 'text-red-500' : 'text-slate-400'}`}>
              {content.length}/{MAX_CHARS}
            </span>
            {error && <span className="text-xs text-red-500">{error}</span>}
          </div>

          <button
            onClick={handlePost}
            disabled={!isValid || posting}
            className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 ${
              isValid && !posting
                ? isAlert
                  ? 'bg-red-600 text-white active:bg-red-700'
                  : 'bg-slate-900 text-white active:bg-slate-800'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {posting ? 'Posting...' : isReplacing ? 'Update' : isAlert ? 'Post Alert' : 'Post'}
          </button>
        </div>
      </div>
    </>
  )
}
