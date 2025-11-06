import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { useAuth } from './store'
import { api } from './api'
import { useAccount } from './accountStore'
import { useNotificationsStore } from './notificationsStore'
import { socket } from './socket'
import Login from './pages/Login'
import Signup from './pages/Signup'
import UserDashboard from './pages/UserDashboard'
import Profile from './pages/Profile'
import History from './pages/History'
import AdminDashboard from './pages/AdminDashboard'
import ResetPassword from './pages/ResetPassword'

const navCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

function BellIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function SunIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function Shell({ children }) {
  const { user, token, logout } = useAuth()
  const accountSummary = useAccount(state => state.summary)
  const setAccountSummary = useAccount(state => state.setSummary)
  const notifications = useNotificationsStore(state => state.notifications)
  const unread = useNotificationsStore(state => state.unread)
  const setNotifications = useNotificationsStore(state => state.setNotifications)
  const appendNotification = useNotificationsStore(state => state.appendNotification)
  const markAllRead = useNotificationsStore(state => state.markAllRead)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [balanceHidden, setBalanceHidden] = useState(() => localStorage.getItem('balance_hidden') === '1')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const nav = useNavigate()
  const menuRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    const root = document.documentElement
    const bodyEl = document.body
    const applied = theme === 'light' ? 'theme-light' : 'theme-dark'

    root.classList.remove('theme-light', 'theme-dark')
    bodyEl.classList.remove('theme-light', 'theme-dark')

    root.classList.add(applied)
    bodyEl.classList.add(applied)

    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (!token) return
    if (accountSummary) return
    api(token).get('/api/trades/overview', { params: { limit: 1 } })
      .then(res => setAccountSummary(res.data))
      .catch(err => console.error('Failed to load account summary', err))
  }, [token, accountSummary, setAccountSummary])

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!token) return
    api(token).get('/api/notifications')
      .then(res => setNotifications(res.data.notifications || [], res.data.unread || 0))
      .catch(err => console.error('Failed to load notifications', err))
  }, [token, setNotifications])

  useEffect(() => {
    if (!token) return

    const playNotificationSound = () => {
      if (typeof window === 'undefined') return
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 880
        osc.connect(gain)
        gain.connect(ctx.destination)
        const now = ctx.currentTime
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
        osc.start(now)
        osc.stop(now + 0.4)
        setTimeout(() => ctx.close(), 500)
      } catch (err) {
        // ignore sound errors
      }
    }

    const handleNotification = ({ notification }) => {
      if (!notification) return
      if (notification.user_id && user?.id && notification.user_id !== user.id) return
      const alreadyOpen = notifOpen
      appendNotification(notification, { read: alreadyOpen })
      if (alreadyOpen) {
        api(token).post('/api/notifications/read', { ids: [notification.id] }).catch(() => {})
      } else {
        playNotificationSound()
      }
    }

    socket.on('notification', handleNotification)
    return () => {
      socket.off('notification', handleNotification)
    }
  }, [token, user?.id, appendNotification, notifOpen])

  const balanceValue = accountSummary?.balance?.total ?? 0
  const formattedBalance = balanceHidden ? '•••••' : navCurrency.format(balanceValue)

  const toggleBalance = () => {
    setBalanceHidden(prev => {
      const next = !prev
      localStorage.setItem('balance_hidden', next ? '1' : '0')
      return next
    })
  }

  const handleNavigate = (path) => {
    setMenuOpen(false)
    nav(path)
  }

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  const menuItems = []
  if (user) {
    menuItems.push({ label: 'Trade', path: '/dashboard' })
    menuItems.push({ label: 'History', path: '/history' })
    menuItems.push({ label: 'Profile', path: '/profile' })
    if (user.role === 'admin') {
      menuItems.push({ label: 'Admin', path: '/admin' })
    }
  }

  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr]">
      <header className="sticky top-0 z-50 bg-black/50 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand via-emerald-400 to-sky-500 flex items-center justify-center font-black text-black text-sm shadow-soft">
              FX
            </div>
          </Link>
          <div className="flex items-center gap-3 flex-wrap justify-end flex-1">
            {user && (
              <div className="balance-chip flex items-center gap-2 bg-black/30 border border-white/10 rounded-full px-4 py-1.5 text-xs sm:text-sm font-mono">
                <span className="tracking-tight">{formattedBalance}</span>
                <button onClick={toggleBalance} className="text-brand hover:text-brand-dark transition-colors">
                  {balanceHidden ? <EyeClosedIcon className="w-4 h-4" /> : <EyeOpenIcon className="w-4 h-4" />}
                </button>
              </div>
            )}
            {!user && (
              <div className="flex items-center gap-2 text-sm">
                <Link to="/login" className="btn">Login</Link>
                <Link to="/signup" className="btn bg-white text-black">Sign up</Link>
              </div>
            )}
            {user && (
              <div className="relative" ref={notifRef}>
                <button
                  className="nav-icon relative flex items-center justify-center w-9 h-9 rounded-full bg-black/30 border border-white/10 text-white/80 hover:text-white transition-colors"
                  onClick={() => {
                    const next = !notifOpen
                    setNotifOpen(next)
                    if (next && unread > 0) {
                      api(token).post('/api/notifications/read-all').then(() => markAllRead()).catch(() => {})
                    }
                  }}
                  aria-label="Toggle notifications"
                >
                  <BellIcon className="w-4 h-4" />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-brand text-black text-[10px] font-semibold rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="fixed inset-0 z-[75] flex items-start justify-center sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:z-50 sm:block sm:flex-none">
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm sm:hidden"
                      onClick={() => setNotifOpen(false)}
                      aria-label="Close notifications overlay"
                    />
                    <div className="notification-panel relative mt-16 w-[min(420px,calc(100%-2rem))] sm:mt-2 mx-auto sm:mx-0 sm:w-72 md:w-80 max-h-[70vh] sm:max-h-[55vh] overflow-hidden rounded-3xl sm:rounded-2xl border border-white/10 bg-[#0b0f13]/95 shadow-soft backdrop-blur text-[11px]">
                      <div className="px-4 py-3 border-b border-white/10 font-semibold flex items-center justify-between sticky top-0 bg-[#0b0f13]/95 z-10 text-[10px] uppercase tracking-wide">
                        <span className="truncate">Notifications</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-white/45 flex-shrink-0">{notifications.length} total</span>
                          <button
                            type="button"
                            onClick={() => setNotifOpen(false)}
                            className="text-[10px] text-white/60 hover:text-white transition-colors sm:hidden"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-white/5 max-h-[calc(70vh-72px)] sm:max-h-[calc(55vh-56px)] overflow-y-auto px-1">
                        {notifications.length === 0 && (
                          <div className="px-4 py-8 text-white/50 text-[11px] text-center space-y-2">
                            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white/5 flex items-center justify-center">
                              <BellIcon className="w-5 h-5 text-white/30" />
                            </div>
                            No notifications yet
                          </div>
                        )}
                        {notifications.map(n => (
                          <div key={n.id} className={`px-2 py-2.5 hover:bg-white/5 transition-colors ${n.is_read ? 'bg-transparent' : 'bg-brand/10 border-l-[3px] border-brand/70'}`}>
                            <div className="w-full space-y-1">
                              <div className="flex items-center gap-1.5 text-[9px] text-white/40 font-mono">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${n.is_read ? 'bg-white/20' : 'bg-brand'}`}></div>
                                <span>{new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div className="font-semibold text-white leading-tight text-[11px] notification-content break-words whitespace-pre-wrap">{n.title}</div>
                              <div className="text-white/65 text-[10px] leading-snug notification-message break-words whitespace-pre-wrap">{n.message}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {notifications.length > 0 && (
                        <div className="px-4 py-3 border-t border-white/10">
                          <button
                            onClick={() => {
                              api(token).post('/api/notifications/read-all').then(() => markAllRead()).catch(() => {})
                            }}
                            className="text-[10px] text-brand hover:text-brand-dark transition-colors notification-content"
                          >
                            Mark all as read
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  className="nav-icon flex items-center gap-2 bg-black/30 border border-white/10 rounded-full px-3 py-1 text-sm"
                  onClick={() => setMenuOpen(o => !o)}
                >
                  <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand font-semibold">
                    {user.name?.[0]?.toUpperCase?.() || user.email?.[0]?.toUpperCase?.() || 'U'}
                  </div>
                  <span className="hidden sm:block">{user.name || user.email}</span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-[#0b0f13] shadow-soft p-2 space-y-1 text-sm">
                    {menuItems.map(item => (
                      <button
                        key={item.path}
                        onClick={() => handleNavigate(item.path)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10"
                      >{item.label}</button>
                    ))}
                    <button
                      onClick={toggleTheme}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-2"
                    >
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white text-slate-900">
                        {theme === 'light' ? <MoonIcon className="w-3.5 h-3.5" /> : <SunIcon className="w-3.5 h-3.5" />}
                      </span>
                      <span>{theme === 'light' ? 'Night mode' : 'Day mode'}</span>
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); logout(); nav('/'); }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-rose-400"
                    >Log out</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto w-full p-4">
        {children}
      </main>
      <footer className="border-t border-white/10 p-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} OTC Market — Demo build
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
              Trade a simulated <span className="text-brand">Admin‑Controlled</span> OTC Market
            </h1>
            <p className="text-white/70">Live candlesticks, manual trading, referrals, and a full admin dashboard to orchestrate the market.</p>
            <div className="flex gap-3">
              <Link to="/signup" className="btn">Get started</Link>
              <Link to="/login" className="btn bg-white text-black">Sign in</Link>
            </div>
          </div>
          <div className="card">
            <p className="text-white/70">Login as admin to control price, volatility and more.</p>
            <div className="mt-3 p-3 bg-black/30 rounded-xl text-xs">
              Admin (dev): admin@example.com / Admin#12345
            </div>
          </div>
        </div>
      </Shell>} />
      <Route path="/login" element={<Shell><Login /></Shell>} />
      <Route path="/signup" element={<Shell><Signup /></Shell>} />
      <Route path="/reset-password" element={<Shell><ResetPassword /></Shell>} />
      <Route path="/dashboard" element={<Shell><UserDashboard /></Shell>} />
      <Route path="/profile" element={<Shell><Profile /></Shell>} />
      <Route path="/history" element={<Shell><History /></Shell>} />
      <Route path="/admin" element={<Shell><AdminDashboard /></Shell>} />
    </Routes>
  )
}
function EyeOpenIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeClosedIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M3 3l18 18" />
      <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88" />
    </svg>
  )
}
