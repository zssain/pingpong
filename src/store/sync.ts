import { create } from 'zustand'

export type SyncEvent = {
  t: number
  kind:
    | 'peer-connected'
    | 'peer-disconnected'
    | 'msg-sent'
    | 'msg-received'
    | 'sync-complete'
  peerAlias?: string
  messageId?: string
  error?: string
}

interface SyncState {
  events: SyncEvent[]
  appendEvent: (e: SyncEvent) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  events: [],
  appendEvent: (e) =>
    set((s) => ({ events: [e, ...s.events].slice(0, 50) })),
}))
