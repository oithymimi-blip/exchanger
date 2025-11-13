import { create } from 'zustand'

export const useAdminAuth = create((set) => ({
  token: localStorage.getItem('admin_token') || '',
  admin: JSON.parse(localStorage.getItem('admin_user') || 'null'),
  login: (token, admin) => {
    localStorage.setItem('admin_token', token)
    localStorage.setItem('admin_user', JSON.stringify(admin))
    set({ token, admin })
  },
  logout: () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    set({ token: '', admin: null })
  }
}))
