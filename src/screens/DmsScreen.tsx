import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Send, UserPlus, MessageCircle, Lock } from 'lucide-react'
import { useDmsStore, type DecryptedDM } from '../store/dms'
import { useIdentityStore } from '../store/identity'
import { ContactAdd } from '../components/ContactAdd'
import { encryptForRecipient } from '../lib/box'
import { addMessage } from '../db'
import { getOrCreateIdentity } from '../db'
import { timeAgo } from '../lib/timeago'
import { canonicalize, computeMessageId } from '../lib/canonical'
import { signMessage } from '../lib/identity'
import type { Message } from '../types'
import { PRIORITY, TTL } from '../types'

export function DmsScreen() {
  const contacts = useDmsStore((s) => s.contacts)
  const threads = useDmsStore((s) => s.threads)
  const activeThread = useDmsStore((s) => s.activeThread)
  const loadContacts = useDmsStore((s) => s.loadContacts)
  const loadThread = useDmsStore((s) => s.loadThread)
  const setActiveThread = useDmsStore((s) => s.setActiveThread)
  const myPubkey = useIdentityStore((s) => s.pubkey)

  const [contactModalOpen, setContactModalOpen] = useState(false)

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  // Poll thread when active
  useEffect(() => {
    if (!activeThread) return
    loadThread(activeThread)
    const id = setInterval(() => loadThread(activeThread), 3000)
    return () => clearInterval(id)
  }, [activeThread, loadThread])

  const thread = activeThread ? threads.get(activeThread) : null

  if (activeThread && thread) {
    return (
      <Conversation
        thread={thread}
        myPubkey={myPubkey!}
        onBack={() => setActiveThread(null)}
        onRefresh={() => loadThread(activeThread)}
      />
    )
  }

  // Thread list
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Messages</h2>
        <button
          onClick={() => setContactModalOpen(true)}
          className="p-2 text-slate-500 hover:text-slate-700 transition-colors duration-150"
        >
          <UserPlus size={20} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
        <Lock size={12} />
        <span>End-to-end encrypted</span>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">No contacts yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Tap <UserPlus size={12} className="inline" /> to add someone.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {contacts.map((c) => {
            const t = threads.get(c.pubkey)
            const lastMsg = t?.messages[t.messages.length - 1]
            const preview = lastMsg?.decryptedText ?? (lastMsg ? 'encrypted...' : 'No messages yet')

            return (
              <button
                key={c.pubkey}
                onClick={() => {
                  setActiveThread(c.pubkey)
                  loadThread(c.pubkey)
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors duration-150 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-500 shrink-0">
                  {c.alias.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800 truncate">{c.alias}</span>
                    {lastMsg && (
                      <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(lastMsg.timestamp)}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{preview}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Load threads for previews */}
      <ThreadPreviewLoader contacts={contacts} />

      <ContactAdd open={contactModalOpen} onClose={() => { setContactModalOpen(false); loadContacts() }} />
    </div>
  )
}

/** Silently loads threads for contact list preview. */
function ThreadPreviewLoader({ contacts }: { contacts: { pubkey: string }[] }) {
  const loadThread = useDmsStore((s) => s.loadThread)

  useEffect(() => {
    contacts.forEach((c) => loadThread(c.pubkey))
  }, [contacts, loadThread])

  return null
}

/** Single conversation view. */
function Conversation({
  thread,
  myPubkey,
  onBack,
  onRefresh,
}: {
  thread: { pubkey: string; alias: string; handle: string; messages: DecryptedDM[] }
  myPubkey: string
  onBack: () => void
  onRefresh: () => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thread.messages.length])

  const sendDM = useCallback(async () => {
    if (!text.trim() || sending) return
    setSending(true)

    try {
      const identity = await getOrCreateIdentity()
      const { ciphertext, nonce } = encryptForRecipient(
        text.trim(),
        thread.pubkey,
        identity.privateKey,
      )

      const content = JSON.stringify({ ct: ciphertext, nc: nonce })
      const timestamp = Date.now()

      const msg: Message = {
        id: '',
        type: 'dm',
        content,
        authorPubkey: identity.publicKey,
        authorAlias: undefined,
        recipientPub: thread.pubkey,
        timestamp,
        ttl: timestamp + TTL.DM,
        priority: PRIORITY.DROP, // DMs use priority 1
        hops: [],
      }

      // Compute ID and sign
      msg.id = await computeMessageId(msg)
      const canonical = canonicalize(msg)
      msg.signature = await signMessage(canonical, identity.privateKey)
      // Set alias after signing (not part of canonical)
      const { deriveAlias } = await import('../lib/identity')
      msg.authorAlias = await deriveAlias(identity.publicKey)

      await addMessage(msg)
      setText('')
      onRefresh()
    } catch (e) {
      console.error('[dm] Send failed:', e)
    } finally {
      setSending(false)
    }
  }, [text, sending, thread.pubkey, onRefresh])

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 p-3 border-b border-slate-100 shrink-0">
        <button onClick={onBack} className="p-1 text-slate-500 hover:text-slate-700 transition-colors duration-150">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{thread.alias}</p>
          <p className="text-[10px] text-slate-400 font-mono">{thread.handle}</p>
        </div>
        <Lock size={14} className="text-slate-400" />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {thread.messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">No messages yet. Say hello!</p>
          </div>
        )}
        {thread.messages.map((m) => {
          const isMe = m.authorPubkey === myPubkey
          const displayText = m.decryptedText ?? 'Unable to decrypt'
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-[#0B3D91] text-white rounded-br-md'
                    : 'bg-slate-100 text-slate-800 rounded-bl-md'
                }`}
              >
                <p className="whitespace-pre-wrap">{displayText}</p>
                <p className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                  {timeAgo(m.timestamp)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-slate-100 flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDM() } }}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-full bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <button
          onClick={sendDM}
          disabled={!text.trim() || sending}
          className={`p-2.5 rounded-full transition-colors duration-150 ${
            text.trim() && !sending
              ? 'bg-[#0B3D91] text-white active:bg-[#092d6d]'
              : 'bg-slate-200 text-slate-400'
          }`}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
