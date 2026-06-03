import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getServiceDashboardStats } from '../services/api'
import type { ServiceDashboardStats } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ServiceDashboard() {
  const [stats, setStats] = useState<ServiceDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    getServiceDashboardStats()
      .then((data) => setStats(data))
      .catch(() => setError('Failed to load service dashboard statistics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="card text-center text-red-600 py-12">
        {error || 'No service dashboard data available'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {stats.overdue_count > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <div className="font-semibold">{stats.overdue_count} overdue service{stats.overdue_count !== 1 ? 's' : ''}</div>
              <div className="text-xs text-red-700/80">Please review equipment that is past due.</div>
            </div>
          </div>
        </div>
      )}

      {stats.due_soon_count > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <div className="font-semibold">{stats.due_soon_count} service{stats.due_soon_count !== 1 ? 's' : ''} due soon</div>
              <div className="text-xs text-yellow-700/80">Schedule maintenance for equipment approaching its service date.</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-4">
          <div className="rounded-xl bg-red-600 p-3 text-white">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Overdue Services</p>
            <p className="text-2xl font-bold text-gray-800">{stats.overdue_count}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="rounded-xl bg-yellow-500 p-3 text-white">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Due Soon</p>
            <p className="text-2xl font-bold text-gray-800">{stats.due_soon_count}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="rounded-xl bg-green-600 p-3 text-white">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Completed This Month</p>
            <p className="text-2xl font-bold text-gray-800">{stats.completed_this_month}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Service Status Breakdown</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.status_breakdown} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Overdue by Plant</h2>
            <p className="text-xs text-gray-500">Plants with the most overdue services.</p>
          </div>
          <div className="space-y-2">
            {stats.overdue_by_plant.length === 0 ? (
              <p className="text-sm text-gray-500">No overdue services by plant.</p>
            ) : (
              <ul className="space-y-2">
                {stats.overdue_by_plant.map((plant) => (
                  <li key={plant.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-700">{plant.name}</span>
                    <span className="text-sm font-semibold text-red-700">{plant.overdue_count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Upcoming Services</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Plant</th>
                  <th>Next Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.upcoming_services.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-400 py-6">No upcoming services</td>
                  </tr>
                ) : (
                  stats.upcoming_services.map((item) => (
                    <tr key={item.id}>
                      <td>{item.equipment_name}</td>
                      <td>{item.plant_name || '—'}</td>
                      <td>{item.next_service_date || '—'}</td>
                      <td>{item.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Overdue Services</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Plant</th>
                  <th>Next Service</th>
                </tr>
              </thead>
              <tbody>
                {stats.overdue_services.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-gray-400 py-6">No overdue services</td>
                  </tr>
                ) : (
                  stats.overdue_services.map((item) => (
                    <tr key={item.id}>
                      <td>{item.equipment_name}</td>
                      <td>{item.plant_name || '—'}</td>
                      <td>{item.next_service_date || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
