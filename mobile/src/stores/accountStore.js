import { create } from 'zustand'

export const useAccount = create(set => ({
  summary: null,
  setSummary: summary => set({ summary }),
  clear: () => set({ summary: null })
}))
