import { create } from 'zustand'

export type Tab = 'feed' | 'dms' | 'alerts' | 'connect' | 'drops'

interface Toast {
  id: number
  message: string
}

interface UiState {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  composeOpen: boolean
  setComposeOpen: (open: boolean) => void
  detailMessageId: string | null
  openDetail: (id: string) => void
  closeDetail: () => void
  peerCount: number
  setPeerCount: (n: number) => void
  toasts: Toast[]
  showToast: (message: string, durationMs?: number) => void
  dismissToast: (id: number) => void
  networkMode: 'unknown' | 'lan' | 'offline'
  setNetworkMode: (mode: 'unknown' | 'lan' | 'offline') => void
  lastHandshakeFailed: boolean
  noteHandshakeFail: () => void
  resetHandshakeFail: () => void
}

let toastId = 0

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'feed',
  setActiveTab: (tab) => set({ activeTab: tab }),
  composeOpen: false,
  setComposeOpen: (open) => set({ composeOpen: open }),
  detailMessageId: null,
  openDetail: (id) => set({ detailMessageId: id }),
  closeDetail: () => set({ detailMessageId: null }),
  peerCount: 0,
  setPeerCount: (n) => set({ peerCount: n }),
  toasts: [],
  showToast: (message, durationMs = 3000) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, message }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, durationMs)
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  networkMode: 'unknown',
  setNetworkMode: (mode) => set({ networkMode: mode }),
  lastHandshakeFailed: false,
  noteHandshakeFail: () => set({ lastHandshakeFailed: true }),
  resetHandshakeFail: () => set({ lastHandshakeFailed: false }),
}))
