import { create } from 'zustand'
import { db, type Contact } from '../db/schema'
import type { Message } from '../types'
import { getOrCreateIdentity } from '../db'
import { deriveAlias } from '../lib/identity'
import { decryptFromSender } from '../lib/box'
import { pubkeyToHandle } from '../lib/handle'

export interface DecryptedDM extends Message {
  decryptedText: string | null
}

export interface DMThread {
  pubkey: string
  alias: string
  handle: string
  messages: DecryptedDM[]
}

interface DmsState {
  contacts: Contact[]
  threads: Map<string, DMThread>
  activeThread: string | null
  loadContacts: () => Promise<void>
  addContact: (pubkey: string, handle: string) => Promise<void>
  loadThread: (pubkey: string) => Promise<void>
  setActiveThread: (pubkey: string | null) => void
}

export const useDmsStore = create<DmsState>((set, get) => ({
  contacts: [],
  threads: new Map(),
  activeThread: null,

  async loadContacts() {
    const contacts = await db.contacts.toArray()
    set({ contacts })
  },

  async addContact(pubkey: string, handle: string) {
    const alias = await deriveAlias(pubkey)
    const contact: Contact = {
      pubkey,
      handle,
      alias,
      addedAt: Date.now(),
    }
    await db.contacts.put(contact)
    await get().loadContacts()
  },

  async loadThread(pubkey: string) {
    const identity = await getOrCreateIdentity()
    const myPub = identity.publicKey

    // Get all DMs between us and this contact
    const allDms = await db.messages
      .where('type')
      .equals('dm')
      .toArray()

    const threadMsgs = allDms.filter(
      (m) =>
        (m.authorPubkey === pubkey && m.recipientPub === myPub) ||
        (m.authorPubkey === myPub && m.recipientPub === pubkey),
    )

    // Sort by timestamp ascending (chronological)
    threadMsgs.sort((a, b) => a.timestamp - b.timestamp)

    // Decrypt each message
    const decrypted: DecryptedDM[] = threadMsgs.map((m) => {
      let decryptedText: string | null = null
      try {
        const parsed = JSON.parse(m.content) as { ct: string; nc: string }
        if (parsed.ct && parsed.nc) {
          // Determine who sent it to figure out keys
          const senderPub = m.authorPubkey!
          decryptedText = decryptFromSender(
            parsed.ct,
            parsed.nc,
            senderPub,
            identity.privateKey,
          )
        }
      } catch {
        decryptedText = null
      }
      return { ...m, decryptedText }
    })

    const alias = await deriveAlias(pubkey)
    const handle = pubkeyToHandle(pubkey)
    const threads = new Map(get().threads)
    threads.set(pubkey, { pubkey, alias, handle, messages: decrypted })
    set({ threads })
  },

  setActiveThread(pubkey: string | null) {
    set({ activeThread: pubkey })
  },
}))
