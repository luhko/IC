import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface VarState {
  values: Record<string, string>
  setVar: (name: string, value: string) => void
  clearAll: () => void
  hydrateDefaults: (names: string[]) => void
}

export const useVars = create<VarState>()(
  persist(
    (set) => ({
      values: {},
      setVar: (name, value) =>
        set((s) => ({ values: { ...s.values, [name]: value } })),
      clearAll: () => set({ values: {} }),
      hydrateDefaults: (names) =>
        set((s) => {
          const next = { ...s.values }
          for (const n of names) if (!(n in next)) next[n] = ''
          return { values: next }
        }),
    }),
    { name: 'ic-vars' },
  ),
)
