import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../../adminStore'
import { useEffect } from 'react'

const navItems = [
  { label: 'Dashboard', icon: '📊', path: '/admin', permission: 'analytics' },
  { label: 'Market Control', icon: '⚙️', path: '/admin/market-control', permission: 'market' },
  { label: 'Users', icon: '👥', path: '/admin/users', permission: 'users' },
  { label: 'Notifications', icon: '🔔', path: '/admin/notifications', permission: 'notifications' },
  { label: 'Roles', icon: '🛡️', path: '/admin/roles', permission: 'admin_manage' }
]

export default function AdminLayout() {
  const { token, admin, logout } = useAdminAuth()
  const nav = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!token) {
      nav('/admin/login', { replace: true })
    }
  }, [token, nav])

  const can = (perm) => {
    if (admin?.role === 'admin') return true
    if (!perm) return !!admin
    const permissions = admin?.permissions || []
    return permissions.includes('all') || permissions.includes(perm)
  }

  if (!token) return null

  const navLinkBaseClasses = 'flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-medium transition'
  const activeNavLinkClasses = 'bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow-lg font-semibold hover:opacity-90'
  const inactiveNavLinkClasses = 'text-slate-600 hover:bg-slate-50'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-2 font-semibold text-lg">
          <span className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">FX</span>
          Velzon Admin
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.filter(item => can(item.permission)).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              className={({ isActive }) => `${navLinkBaseClasses} ${isActive ? activeNavLinkClasses : inactiveNavLinkClasses}`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-slate-200">
          <button
            className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            onClick={() => { logout(); nav('/admin/login', { replace: true }) }}
          >
            Log out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="text-slate-400 text-lg">🔎</span>
            <span>Search the console</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
              {admin?.permissions?.includes('all') ? 'Super Admin' : 'Sub Admin'}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-sm font-semibold">{admin?.name || admin?.email}</div>
                <div className="text-xs text-slate-500">{admin?.email}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-sky-400 text-white flex items-center justify-center font-semibold">
                {(admin?.name || admin?.email || 'A').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
