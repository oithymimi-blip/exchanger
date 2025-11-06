import axios from 'axios'

const defaultBase = (() => {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:4000`
  }
  return 'http://localhost:4000'
})()

const API_BASE = import.meta.env.VITE_API_BASE || defaultBase

export function api(token) {
  const instance = axios.create({
    baseURL: API_BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return instance
}
