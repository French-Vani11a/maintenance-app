import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/records': 'Maintenance Records',
  '/records/new': 'New Record',
  '/equipment': 'Equipment Management',
  '/service-dashboard': 'Service Dashboard',
  '/users': 'Users Management',
  '/change-password': 'Change Password',
  '/import': 'Import from Excel',
  '/reports': 'Reports & Export',
}

export default function Layout() {
  const location = useLocation()
  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] ?? 'Maintenance'

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
