import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/staff', label: 'Dashboard', end: true, icon: '📊' },
  { to: '/staff/menu', label: 'Menu', roles: ['admin', 'manager'], icon: '🍽️' },
  { to: '/staff/stock', label: 'Stock', roles: ['admin', 'manager'], icon: '📦' },
  { to: '/staff/take-order', label: 'Take Order', icon: '📝' },
  { to: '/staff/active', label: 'Active Orders', icon: '🔥' },
  { to: '/staff/history', label: 'History', icon: '📜' },
]

export default function StaffLayout() {
  const { profile, signOut, role } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  function closeSidebar() {
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 bg-green-950 border-b border-green-900 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-2xl p-1"
          aria-label="Open menu"
        >
          ☰
        </button>
        <div className="font-bold text-sm">LA VERDURE · Staff</div>
        <button
          onClick={handleLogout}
          className="text-xs px-2 py-1 rounded border border-green-700"
        >
          Logout
        </button>
      </div>

      {/* Overlay when sidebar is open on mobile */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={closeSidebar}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed md:static inset-y-0 left-0 z-50
            w-64 bg-green-950 border-r border-green-900
            flex flex-col
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <div className="p-5 border-b border-green-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-green-700 flex items-center justify-center text-xl">🌿</div>
              <div>
                <div className="font-bold text-lg leading-tight">LA VERDURE</div>
                <div className="text-xs text-green-300">Staff Panel</div>
              </div>
            </div>
            <button
              onClick={closeSidebar}
              className="md:hidden text-2xl text-green-300 p-1"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems
              .filter((item) => !item.roles || item.roles.includes(role))
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-green-800 text-white'
                        : 'text-green-200 hover:bg-green-900'
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
          </nav>

          <div className="p-4 border-t border-green-900 space-y-3">
            <div className="text-sm">
              <div className="font-medium truncate">{profile?.full_name || profile?.email}</div>
              <div className="text-xs text-green-400 capitalize">{role}</div>
            </div>

            <div className="flex flex-col gap-2">
              <a
                href="/order"
                onClick={closeSidebar}
                className="text-center text-sm px-3 py-2 rounded-lg border border-green-700 hover:bg-green-900"
              >
                Customer View
              </a>
              <button
                onClick={handleLogout}
                className="text-sm px-3 py-2 rounded-lg bg-red-900/50 hover:bg-red-900 text-red-200"
              >
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Page content */}
        <div className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto p-4 sm:p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}