import io from 'socket.io-client'

const defaultBase = (() => {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:4000`
  }
  return 'http://localhost:4000'
})()

const API_BASE = import.meta.env.VITE_API_BASE || defaultBase

export const socket = io(API_BASE, { transports: ['websocket'], autoConnect: true })
