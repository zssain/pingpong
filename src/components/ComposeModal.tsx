import { useState } from 'react'
import { X } from 'lucide-react'
import { useUiStore } from '../store/ui'
import { useMessagesStore } from '../store/messages'
import { createLocalMessage } from '../lib/createMessage'

const MAX_CHARS = 280

type PostType = 'news' | 'alert' | 'drop'

export function ComposeModal() {
  const composeOpen = useUiStore((s) => s.composeOpen)
  const setComposeOpen = useUiStore((s) => s.setComposeOpen)
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const addLocalMessage = useMessagesStore((s) => s.addLocalMessage)

  const [type, setType] = useState<PostType>('news')
  const [content, setContent] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [location, setLocation] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAlert = type === 'alert'
  const canBeAnonymous = type !== 'alert'
  const isValid =
    content.trim().length > 0 &&
    content.length <= MAX_CHARS &&
    (!isAlert || location.trim().length > 0)

  function close() {
    setComposeOpen(false)
    setContent('')
    setAnonymous(false)
    setLocation('')
    setType('news')
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
      })
      await addLocalMessage(msg)
      // Switch to feed/alerts tab to see the new message
      setActiveTab(isAlert ? 'alerts' : 'feed')
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-200 ${
          composeOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-w-md mx-auto transition-transform duration-200 ease-out ${
          composeOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              New post
            </h3>
            <button
              onClick={close}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors duration-150"
            >
              <X size={20} />
            </button>
          </div>

          {/* Type selector */}
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

          {/* Anonymous checkbox */}
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

          {/* Location input for alerts */}
          {isAlert && (
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (e.g. Central Clinic, Main Road)"
              className="w-full px-3 py-2 mb-3 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          )}

          {/* Content textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            placeholder={
              isAlert
                ? 'Describe the emergency...'
                : 'What\'s happening in your area?'
            }
            rows={4}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
          />

          {/* Char counter */}
          <div className="flex items-center justify-between mt-1 mb-3">
            <span
              className={`text-xs ${
                content.length > MAX_CHARS - 20
                  ? 'text-red-500'
                  : 'text-slate-400'
              }`}
            >
              {content.length}/{MAX_CHARS}
            </span>
            {error && (
              <span className="text-xs text-red-500">{error}</span>
            )}
          </div>

          {/* Post button */}
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
            {posting ? 'Posting...' : isAlert ? 'Post Alert' : 'Post'}
          </button>
        </div>
      </div>
    </>
  )
}
