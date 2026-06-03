import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  Activity,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  History,
  Layers,
  Package,
  User as UserIcon,
  Wrench,
  Zap,
} from 'lucide-react'
import { getAuditLogs, getUsers } from '../services/api'
import type { AuditLog, User } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'

const ITEM_TYPE_META: Record<string, { icon: React.ElementType; label: string }> = {
  maintenance_record: { icon: ClipboardList, label: 'Maintenance Record' },
  equipment:          { icon: Wrench,        label: 'Equipment' },
  equipment_group:    { icon: Layers,         label: 'Equipment Group' },
  plant:              { icon: Building2,      label: 'Plant' },
  user:               { icon: UserIcon,       label: 'User' },
  service_history:    { icon: History,        label: 'Service History' },
  service_job_card:   { icon: Zap,            label: 'Service Job Card' },
  parts_replacement:  { icon: Package,        label: 'Parts Replacement' },
}

function ItemTypeBadge({ type }: { type: string }) {
  const meta = ITEM_TYPE_META[type]
  const Icon = meta?.icon ?? Activity
  const label = meta?.label ?? type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
      <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
      {label}
    </span>
  )
}

const PAGE_SIZE = 50

export default function AdminLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    userId: '',
    action: '',
    itemType: '',
  })
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => { loadUsers() }, [])
  useEffect(() => { loadLogs() }, [filters, currentPage])

  async function loadUsers() {
    try {
      setUsers(await getUsers())
    } catch {
      // non-fatal
    }
  }

  async function loadLogs() {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        skip: currentPage * PAGE_SIZE,
        limit: PAGE_SIZE,
      }
      if (filters.dateFrom) params.date_from = filters.dateFrom
      if (filters.dateTo)   params.date_to   = filters.dateTo
      if (filters.userId)   params.user_id   = parseInt(filters.userId)
      if (filters.action)   params.action    = filters.action
      if (filters.itemType) params.item_type = filters.itemType

      const { total: t, logs: l } = await getAuditLogs(params)
      setTotal(t)
      setLogs(l)
    } catch {
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  function handleFilterChange(field: string, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setCurrentPage(0)
  }

  function exportLogs() {
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Item Type', 'Item ID', 'Details'],
      ...logs.map((log) => [
        format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        log.user_name,
        log.action,
        log.item_type,
        log.item_id || '',
        log.details || '',
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <button
          onClick={exportLogs}
          className="btn-primary flex items-center gap-2"
          disabled={logs.length === 0}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label className="label flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />From Date</label>
            <input type="date" className="input" value={filters.dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="label flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />To Date</label>
            <input type="date" className="input" value={filters.dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="label flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5" />User</label>
            <select className="input" value={filters.userId} onChange={(e) => handleFilterChange('userId', e.target.value)}>
              <option value="">All Users</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="label flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Action</label>
            <select className="input" value={filters.action} onChange={(e) => handleFilterChange('action', e.target.value)}>
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="import">Import</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Item Type</label>
            <select className="input" value={filters.itemType} onChange={(e) => handleFilterChange('itemType', e.target.value)}>
              <option value="">All Types</option>
              <option value="maintenance_record">Maintenance Record</option>
              <option value="equipment">Equipment</option>
              <option value="equipment_group">Equipment Group</option>
              <option value="plant">Plant</option>
              <option value="user">User</option>
              <option value="service_job_card">Service Job Card</option>
              <option value="service_history">Service History</option>
              <option value="parts_replacement">Parts Replacement</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Item Type</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="text-sm text-gray-600 whitespace-nowrap">
                  {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                </td>
                <td className="text-sm text-gray-900">{log.user_name}</td>
                <td>
                  <span className={`badge ${
                    log.action === 'create' ? 'bg-green-100 text-green-800' :
                    log.action === 'update' ? 'bg-blue-100 text-blue-800' :
                    log.action === 'delete' ? 'bg-red-100 text-red-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td><ItemTypeBadge type={log.item_type} /></td>
                <td className="text-sm text-gray-500 max-w-xs truncate">{log.details}</td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-8">No audit logs found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {total === 0 ? 'No logs' : `Showing ${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, total)} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary btn-sm"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage + 1} {totalPages > 0 ? `of ${totalPages}` : ''}
          </span>
          <button
            className="btn-secondary btn-sm"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
