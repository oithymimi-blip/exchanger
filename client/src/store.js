import { create } from 'zustand'
import { useAccount } from './accountStore'

export const useAuth = create((set) => ({
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  login: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    useAccount.getState().clear();
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    useAccount.getState().clear();
    set({ token: '', user: null });
  }
}))
