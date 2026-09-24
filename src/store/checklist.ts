import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Progress = 'untested' | 'in_progress' | 'tested'
export type Result = 'unknown' | 'vuln' | 'partial' | 'notvuln'

export interface CheckItem {
  status: Progress
  result: Result
  note?: string
}

export const DEFAULT_ITEM: CheckItem = { status: 'untested', result: 'unknown' }

interface ChecklistState {
  items: Record<string, CheckItem>
  setStatus: (slug: string, status: Progress) => void
  setResult: (slug: string, result: Result) => void
  setNote: (slug: string, note: string) => void
  clearAll: () => void
}

export const useChecklist = create<ChecklistState>()(
  persist(
    (set) => ({
      items: {},
      setStatus: (slug, status) =>
        set((s) => ({
          items: {
            ...s.items,
            [slug]: { ...(s.items[slug] ?? DEFAULT_ITEM), status },
          },
        })),
      setResult: (slug, result) =>
        set((s) => ({
          items: {
            ...s.items,
            [slug]: { ...(s.items[slug] ?? DEFAULT_ITEM), result },
          },
        })),
      setNote: (slug, note) =>
        set((s) => ({
          items: {
            ...s.items,
            [slug]: { ...(s.items[slug] ?? DEFAULT_ITEM), note },
          },
        })),
      clearAll: () => set({ items: {} }),
    }),
    { name: 'ic-checklist' },
  ),
)
