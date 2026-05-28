import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, FileText, LayoutDashboard, CheckSquare, Bookmark, Settings as SettingsIcon } from 'lucide-react'
import UserPopover from './UserPopover'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/daily', icon: CalendarDays, label: '日报' },
  { to: '/weekly', icon: FileText, label: '周报' },
  { to: '/tasks', icon: CheckSquare, label: '任务' },
  { to: '/knowledge', icon: Bookmark, label: '知识' },
]

const bottomNavItems = [
  { to: '/settings', icon: SettingsIcon, label: '设置' },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen bg-bg-root">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col bg-bg-sidebar border-r border-border-subtle">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-border-subtle px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent font-bold text-sm font-serif">
            日
          </div>
          <span className="font-serif text-lg font-semibold tracking-tight text-text-primary">
            工作日报
          </span>
        </div>

        {/* Main nav */}
        <nav className="mt-5 flex-1 space-y-0.5 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-subtle text-accent border border-accent/10'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom nav */}
        <div className="border-t border-border-subtle px-3 py-3 space-y-0.5">
          {bottomNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-subtle text-accent border border-accent/10'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Bottom — user bar */}
        <div className="border-t border-border-subtle px-3 py-3">
          {user && <UserPopover user={user} onLogout={logout} />}
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
