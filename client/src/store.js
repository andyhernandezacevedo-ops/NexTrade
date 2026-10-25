import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSessionStore = create(persist(
  (set) => ({
    user: null,
    token: null,
    setSession: (session) => set({ user: session.user, token: session.token }),
    clearSession: () => set({ user: null, token: null }),
  }),
  {
    name: 'nextrade-session',
    partialize: ({ user, token }) => ({ user, token }),
  },
))
