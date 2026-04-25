import { create } from 'zustand'
import { getVisibleMessages, addMessage } from '../db'
import type { Message } from '../types'

interface MessagesState {
  messages: Message[]
  recentlyArrivedIds: Set<string>
  loadMessages: (type?: Message['type']) => Promise<void>
  addLocalMessage: (msg: Message) => Promise<void>
  markRecentlyArrived: (id: string) => void
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: [],
  recentlyArrivedIds: new Set(),

  async loadMessages(type) {
    const messages = await getVisibleMessages(type)
    set({ messages })
  },

  async addLocalMessage(msg) {
    await addMessage(msg)
    const messages = await getVisibleMessages()
    set({ messages })
    get().markRecentlyArrived(msg.id)
  },

  markRecentlyArrived(id) {
    set((state) => {
      const next = new Set(state.recentlyArrivedIds)
      next.add(id)
      return { recentlyArrivedIds: next }
    })
    setTimeout(() => {
      set((state) => {
        const next = new Set(state.recentlyArrivedIds)
        next.delete(id)
        return { recentlyArrivedIds: next }
      })
    }, 1500)
  },
}))
