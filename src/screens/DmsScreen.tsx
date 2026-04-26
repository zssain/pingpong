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

  useEffect(() => { loadContacts() }, [loadContacts])

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

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-text-muted">MESSAGES</h2>
        <button
          onClick={() => setContactModalOpen(true)}
          className="p-2 text-text-muted hover:text-accent transition-colors duration-150"
        >
          <UserPlus size={18} />
        </button>
      </div>

      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-dim mb-5 border-y border-border py-2">
        <Lock size={11} />
        <span>END-TO-END ENCRYPTED</span>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <MessageCircle size={24} className="mx-auto text-text-dim stroke-1" />
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-dim">NO CONTACTS</div>
          <p className="text-xs font-mono text-text-muted">Tap + to add a contact handle.</p>
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
                onClick={() => { setActiveThread(c.pubkey); loadThread(c.pubkey) }}
                className="w-full flex items-center gap-3 p-3 border border-transparent hover:border-border hover:bg-accent-glow active:scale-[0.99] transition-all duration-150 text-left"
              >
                <div className="w-9 h-9 bg-surface-2 border border-border flex items-center justify-center text-xs font-mono text-text-muted shrink-0">
                  {c.alias.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-text truncate">{c.alias}</span>
                    {lastMsg && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim shrink-0">{timeAgo(lastMsg.timestamp)}</span>
                    )}
                  </div>
                  <p className="text-xs font-body text-text-muted truncate">{preview}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <ThreadPreviewLoader contacts={contacts} />
      <ContactAdd open={contactModalOpen} onClose={() => { setContactModalOpen(false); loadContacts() }} />
    </div>
  )
}

function ThreadPreviewLoader({ contacts }: { contacts: { pubkey: string }[] }) {
  const loadThread = useDmsStore((s) => s.loadThread)
  useEffect(() => { contacts.forEach((c) => loadThread(c.pubkey)) }, [contacts, loadThread])
  return null
}

function Conversation({
  thread, myPubkey, onBack, onRefresh,
}: {
  thread: { pubkey: string; alias: string; handle: string; messages: DecryptedDM[] }
  myPubkey: string
  onBack: () => void
  onRefresh: () => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [thread.messages.length])

  const sendDM = useCallback(async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const identity = await getOrCreateIdentity()
      const { ciphertext, nonce } = encryptForRecipient(text.trim(), thread.pubkey, identity.privateKey)
      const content = JSON.stringify({ ct: ciphertext, nc: nonce })
      const timestamp = Date.now()
      const msg: Message = {
        id: '', type: 'dm', content,
        authorPubkey: identity.publicKey, authorAlias: undefined,
        recipientPub: thread.pubkey, timestamp,
        ttl: timestamp + TTL.DM, priority: PRIORITY.DROP, hops: [],
      }
      msg.id = await computeMessageId(msg)
      const canonical = canonicalize(msg)
      msg.signature = await signMessage(canonical, identity.privateKey)
      const { deriveAlias } = await import('../lib/identity')
      msg.authorAlias = await deriveAlias(identity.publicKey)
      await addMessage(msg)
      setText('')
      onRefresh()
    } catch (e) { console.error('[dm] Send failed:', e) }
    finally { setSending(false) }
  }, [text, sending, thread.pubkey, onRefresh])

  return (
    <div className="flex flex-col h-[calc(100vh-48px-80px)] bg-bg">
      {/* Top bar */}
      <div className="flex items-center gap-3 p-3 border-b border-border shrink-0 bg-surface">
        <button onClick={onBack} className="p-1 text-text-muted hover:text-accent transition-colors duration-150">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-text truncate">{thread.alias}</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">{thread.handle}</p>
        </div>
        <Lock size={12} className="text-accent-dim" />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {thread.messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xs font-mono uppercase tracking-wider text-text-dim">NO MESSAGES YET</p>
          </div>
        )}
        {thread.messages.map((m) => {
          const isMe = m.authorPubkey === myPubkey
          const displayText = m.decryptedText ?? 'Unable to decrypt'
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] px-3 py-2 text-sm font-body ${
                isMe
                  ? 'bg-accent/10 border border-accent-dim text-text ml-auto'
                  : 'bg-surface border border-border text-text'
              }`}>
                <p className="whitespace-pre-wrap">{displayText}</p>
                <p className={`text-[9px] font-mono uppercase tracking-wider mt-1 ${isMe ? 'text-accent-dim' : 'text-text-dim'}`}>
                  {timeAgo(m.timestamp)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-border bg-surface flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDM() } }}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 text-sm font-body bg-surface-2 border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors duration-150"
        />
        <button
          onClick={sendDM}
          disabled={!text.trim() || sending}
          className={`p-2.5 border transition-colors duration-150 ${
            text.trim() && !sending
              ? 'border-accent text-accent bg-accent/5 hover:bg-accent/15'
              : 'border-border text-text-dim'
          }`}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
