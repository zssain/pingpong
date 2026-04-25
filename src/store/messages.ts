import { create } from 'zustand'
import { getVisibleMessages, addMessage } from '../db'
import type { Message } from '../types'

interface MessagesState {
  messages: Message[]
  loadMessages: (type?: Message['type']) => Promise<void>
  addLocalMessage: (msg: Message) => Promise<void>
}

export const useMessagesStore = create<MessagesState>((set) => ({
  messages: [],

  async loadMessages(type) {
    const messages = await getVisibleMessages(type)
    set({ messages })
  },

  async addLocalMessage(msg) {
    await addMessage(msg)
    const messages = await getVisibleMessages()
    set({ messages })
  },
}))
