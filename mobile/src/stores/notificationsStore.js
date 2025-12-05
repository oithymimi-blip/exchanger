import { create } from 'zustand'

export const useNotificationsStore = create(set => ({
  notifications: [],
  unread: 0,
  setNotifications: (notifications, unread = 0) => set({ notifications, unread }),
  appendNotification: (notification, { read = false } = {}) =>
    set(state => {
      const exists = state.notifications.find(n => n.id === notification.id)
      if (exists) {
        return {
          notifications: state.notifications.map(n =>
            n.id === notification.id ? { ...exists, ...notification } : n
          )
        }
      }
      return {
        notifications: [{ ...notification, is_read: read ? 1 : 0 }, ...state.notifications].slice(0, 200),
        unread: read ? state.unread : state.unread + 1
      }
    }),
  markAllRead: () =>
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, is_read: 1 })),
      unread: 0
    })),
  reset: () => set({ notifications: [], unread: 0 })
}))
