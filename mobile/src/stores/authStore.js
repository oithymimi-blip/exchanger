import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useAccount } from './accountStore'
import { useNotificationsStore } from './notificationsStore'

export const useAuth = create(
  persist(
    (set) => ({
      token: '',
      user: null,
      login: (token, user) => {
        useAccount.getState().clear()
        useNotificationsStore.getState().reset()
        set({ token, user })
      },
      updateUser: (user) => set(state => ({
        user: state.user ? { ...state.user, ...user } : user ?? null
      })),
      logout: () => {
        useAccount.getState().clear()
        useNotificationsStore.getState().reset()
        set({ token: '', user: null })
      }
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        try {
          const token = state?.token
          if (token && typeof token === 'string' && token.startsWith('mock-')) {
            useAccount.getState().clear()
            useNotificationsStore.getState().reset()
            // set is not available in this scope; use store API to reset safely
            try {
              useAuth.setState({ token: '', user: null })
            } catch (err) {
              console.error('Failed to reset auth state during rehydrate', err)
            }
          }
        } catch (err) {
          console.error('Failed to sanitize stored auth state', err)
          try {
            useAuth.setState({ token: '', user: null })
          } catch (_err) {
            // ignore secondary failure
          }
        }
      }
    }
  )
)
