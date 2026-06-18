import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart2,
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  Download,
  FileText,
  History,
  KeyRound,
  LogOut,
  Shield,
  Wrench,
  Zap,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

type NavItem = { to: string; icon: React.ElementType; label: string }

type Group = {
  key: string
  label: string
  icon: React.ElementType
  items: NavItem[]
  adminOnly?: boolean
}

const groups: Group[] = [
  {
    key: 'dashboards',
    label: 'Dashboards',
    icon: BarChart2,
    items: [
      { to: '/dashboard', icon: BarChart2, label: 'Dashboard' },
      { to: '/service-dashboard', icon: CalendarCheck, label: 'Service Dashboard' },
    ],
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    icon: Wrench,
    items: [
      { to: '/records', icon: ClipboardList, label: 'Records' },
      { to: '/equipment', icon: Wrench, label: 'Equipment' },
      { to: '/reports', icon: FileText, label: 'Reports' },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    icon: Shield,
    adminOnly: true,
    items: [
      { to: '/users', icon: Shield, label: 'Users' },
      { to: '/logs', icon: History, label: 'Audit Logs' },
    ],
  },
]

const standaloneNav: NavItem[] = [
  { to: '/service-now', icon: Zap, label: 'Service' },
  { to: '/import', icon: Download, label: 'Import' },
]

const generalNav: NavItem[] = [
  { to: '/change-password', icon: KeyRound, label: 'Change Password' },
]

function groupForPath(pathname: string): string | null {
  for (const g of groups) {
    if (g.items.some((item) => pathname.startsWith(item.to))) return g.key
  }
  return null
}

function NavGroup({
  group,
  isOpen,
  onToggle,
}: {
  group: Group
  isOpen: boolean
  onToggle: () => void
}) {
  const location = useLocation()
  const isChildActive = group.items.some((item) => location.pathname.startsWith(item.to))
  const Icon = group.icon

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors rounded-lg ${
          isChildActive
            ? 'text-gray-900 bg-gray-200'
            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="mt-0.5 flex flex-col border-l-2 border-gray-300 ml-4">
          {group.items.map(({ to, icon: ItemIcon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 -ml-0.5 text-sm font-medium border-l-2 transition-colors ${
                  isActive
                    ? 'border-transparent text-white rounded-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-200 hover:border-gray-400'
                }`
              }
              style={({ isActive }) => isActive ? { backgroundColor: '#00b450' } : {}}
            >
              <ItemIcon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const [openGroup, setOpenGroup] = useState<string | null>(
    () => groupForPath(location.pathname)
  )

  function toggle(key: string) {
    setOpenGroup((prev) => (prev === key ? null : key))
  }

  const visibleGroups = groups.filter((g) => !g.adminOnly || user?.role === 'admin')

  return (
    <aside className="flex h-screen w-60 flex-col bg-gray-100 text-gray-800 fixed left-0 top-0 z-20 border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center justify-center" style={{ height: '55px' }}>
        <img src="/logo-new.png" alt="Logo" style={{ height: '55px', width: 'auto' }} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleGroups.map((group) => (
          <NavGroup
            key={group.key}
            group={group}
            isOpen={openGroup === group.key}
            onToggle={() => toggle(group.key)}
          />
        ))}

        {standaloneNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`
            }
            style={({ isActive }) => isActive ? { backgroundColor: '#00b450' } : {}}
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
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`
              }
              style={({ isActive }) => isActive ? { backgroundColor: '#00b450' } : {}}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{user?.full_name}</p>
            <p className="truncate text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="ml-2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
