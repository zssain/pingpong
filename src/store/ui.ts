import { create } from 'zustand'

export type Tab = 'feed' | 'dms' | 'alerts' | 'connect' | 'drops'

interface UiState {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  composeOpen: boolean
  setComposeOpen: (open: boolean) => void
  detailMessageId: string | null
  openDetail: (id: string) => void
  closeDetail: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'feed',
  setActiveTab: (tab) => set({ activeTab: tab }),
  composeOpen: false,
  setComposeOpen: (open) => set({ composeOpen: open }),
  detailMessageId: null,
  openDetail: (id) => set({ detailMessageId: id }),
  closeDetail: () => set({ detailMessageId: null }),
}))
