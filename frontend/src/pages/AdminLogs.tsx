import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Download, Search, Calendar, User as UserIcon, Activity } from 'lucide-react'
import { getAuditLogs, getUsers } from '../services/api'
import type { AuditLog, User } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'

export default function AdminLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
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
  const [total, setTotal] = useState(0)
  const pageSize = 50

  useEffect(() => {
    loadUsers()
    loadLogs()
  }, [filters, currentPage])

  async function loadUsers() {
    try {
      const usersData = await getUsers()
      setUsers(usersData)
    } catch (e) {
      console.error('Failed to load users:', e)
    }
  }

  async function loadLogs() {
    setLoading(true)
    try {
      const params: any = {
        skip: currentPage * pageSize,
        limit: pageSize,
      }
      if (filters.dateFrom) params.date_from = filters.dateFrom
      if (filters.dateTo) params.date_to = filters.dateTo
      if (filters.userId) params.user_id = parseInt(filters.userId)
      if (filters.action) params.action = filters.action
      if (filters.itemType) params.item_type = filters.itemType

      const response = await getAuditLogs(params)
      setLogs(response)
      // For simplicity, we'll assume total is not returned; in a real app, you'd want pagination info
      setTotal(response.length + (currentPage * pageSize))
    } catch (e) {
      console.error('Failed to load logs:', e)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  function handleFilterChange(field: string, value: string) {
    setFilters(prev => ({ ...prev, [field]: value }))
    setCurrentPage(0)
  }

  function exportLogs() {
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Item Type', 'Item ID', 'Details'],
      ...logs.map(log => [
        format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        log.user_name,
        log.action,
        log.item_type,
        log.item_id || '',
        log.details || '',
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="label">
              <Calendar className="h-4 w-4" />
              From Date
            </label>
            <input
              type="date"
              className="input"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              <Calendar className="h-4 w-4" />
              To Date
            </label>
            <input
              type="date"
              className="input"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              <UserIcon className="h-4 w-4" />
              User
            </label>
            <select
              className="input"
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              <Activity className="h-4 w-4" />
              Action
            </label>
            <select
              className="input"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="import">Import</option>
            </select>
          </div>
          <div>
            <label className="label">Item Type</label>
            <select
              className="input"
              value={filters.itemType}
              onChange={(e) => handleFilterChange('itemType', e.target.value)}
            >
              <option value="">All Types</option>
              <option value="maintenance_record">Maintenance Record</option>
              <option value="equipment">Equipment</option>
              <option value="equipment_group">Equipment Group</option>
              <option value="plant">Plant</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {log.user_name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      log.action === 'create' ? 'bg-green-100 text-green-800' :
                      log.action === 'update' ? 'bg-blue-100 text-blue-800' :
                      log.action === 'delete' ? 'bg-red-100 text-red-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {log.item_type.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {log.details}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No audit logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, total)} of {total} logs
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary btn-sm"
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage + 1}
            </span>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={logs.length < pageSize}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}