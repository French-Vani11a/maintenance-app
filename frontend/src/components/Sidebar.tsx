import { NavLink } from 'react-router-dom'
import {
  BarChart2,
  ClipboardList,
  Download,
  FileText,
  History,
  KeyRound,
  LogOut,
  Shield,
  Wrench,
  CalendarCheck,
  Zap,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const nav = [
  { to: '/dashboard', icon: BarChart2, label: 'Dashboard' },
  { to: '/records', icon: ClipboardList, label: 'Records' },
  { to: '/equipment', icon: Wrench, label: 'Equipment' },
  { to: '/service-now', icon: Zap, label: 'Service Now' },
  { to: '/service-dashboard', icon: CalendarCheck, label: 'Service Dashboard' },
  { to: '/import', icon: Download, label: 'Import' },
  { to: '/reports', icon: FileText, label: 'Reports' },
]

const adminNav = [
  { to: '/users', icon: Shield, label: 'Users' },
  { to: '/logs', icon: History, label: 'Audit Logs' },
]
const generalNav = [{ to: '/change-password', icon: KeyRound, label: 'Change Password' }]

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-screen w-60 flex-col bg-gray-900 text-gray-100 fixed left-0 top-0 z-20">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
        <img src="/logo.png" alt="Logo" className="h-9 w-9 rounded-lg" />
        <div>
          <p className="text-sm font-bold leading-tight">Maintenance</p>
          <p className="text-xs text-gray-400 leading-tight">Management System</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
        {user?.role === 'admin' &&
          adminNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        {user?.role === 'general' &&
          generalNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-800 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
            <p className="truncate text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
