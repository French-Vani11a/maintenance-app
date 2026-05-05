import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { exportRecordsCsv, getEquipmentGroups, getPlants, getRecords } from '../services/api'
import type { EquipmentGroup, MaintenanceRecord, Plant, RecordFilters } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'

function fmtMins(mins: number | null) {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'closed') return <span className="badge-closed">Closed</span>
  if (status === 'in-progress') return <span className="badge-in-progress">In Progress</span>
  return <span className="badge-open">Open</span>
}

export default function Reports() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [groups, setGroups] = useState<EquipmentGroup[]>([])
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const PAGE_SIZE = 50

  const now = new Date()
  const [filters, setFilters] = useState<RecordFilters>({
    date_from: format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'),
    date_to: format(now, 'yyyy-MM-dd'),
  })

  useEffect(() => {
    getPlants().then(setPlants)
    getEquipmentGroups().then(setGroups)
  }, [])

  useEffect(() => {
    setLoading(true)
    getRecords({ ...filters, limit: PAGE_SIZE, skip: page * PAGE_SIZE })
      .then(({ records, total }) => {
        setRecords(records)
        setTotal(total)
      })
      .finally(() => setLoading(false))
  }, [filters, page])

  function handleFilter(key: keyof RecordFilters, value: string) {
    setFilters((f) => {
      const newFilters = { ...f, [key]: value || undefined }
      // Clear equipment_group_id when plant changes
      if (key === 'plant_id') {
        newFilters.equipment_group_id = undefined
      }
      return newFilters
    })
  }

  // Summary stats from loaded records
  const totalMinutes = records.reduce((s, r) => s + (r.downtime_minutes || 0), 0)
  const openCount = records.filter((r) => r.status === 'open').length
  const closedCount = records.filter((r) => r.status === 'closed').length

  async function downloadCsv() {
    try {
      setError('')
      const { blob, filename } = await exportRecordsCsv(filters)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to export CSV')
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">Filter Report</h2>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              className="input w-40"
              value={filters.date_from || ''}
              onChange={(e) => handleFilter('date_from', e.target.value)}
            />
          </div>
          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              className="input w-40"
              value={filters.date_to || ''}
              onChange={(e) => handleFilter('date_to', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Plant</label>
            <select className="input w-44" value={filters.plant_id || ''} onChange={(e) => handleFilter('plant_id', e.target.value)}>
              <option value="">All Plants</option>
              {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Equipment Group</label>
            <select className="input w-44" value={filters.equipment_group_id || ''} onChange={(e) => handleFilter('equipment_group_id', e.target.value)}>
              <option value="">
                {filters.plant_id ? 'All Groups' : 'No plant selected'}
              </option>
              {filters.plant_id ? groups
                .filter((g) => g.plant_id === Number(filters.plant_id))
                .map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                )) : null}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input w-36" value={filters.status || ''} onChange={(e) => handleFilter('status', e.target.value)}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="label">MR No</label>
            <input
              type="text"
              className="input w-40"
              placeholder="e.g. MR-0123"
              value={filters.mr_no || ''}
              onChange={(e) => handleFilter('mr_no', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Artisan</label>
            <input
              type="text"
              className="input w-44"
              placeholder="Artisan name"
              value={filters.artisan_name || ''}
              onChange={(e) => handleFilter('artisan_name', e.target.value)}
            />
          </div>
          <div>
            <label className="label">created_by</label>
            <input
              type="text"
              className="input w-44"
              placeholder="Created by user"
              value={filters.created_by || ''}
              onChange={(e) => handleFilter('created_by', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Records', value: total },
          { label: 'Open', value: openCount },
          { label: 'Closed', value: closedCount },
          { label: 'Total Downtime', value: fmtMins(totalMinutes) },
        ].map(({ label, value }) => (
          <div key={label} className="card text-center">
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Export buttons */}
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={downloadCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </button>
        <p className="text-sm text-gray-500">
          Exports all records matching current filters (up to 10,000 rows)
        </p>
      </div>

      {/* Records table */}
      <div className="table-container">
        {loading ? (
          <div className="flex h-48 items-center justify-center bg-white">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>MR No</th>
                <th>Plant</th>
                <th>Equipment</th>
                <th>Artisan</th>
                <th>created_by</th>
                <th>Issue</th>
                <th>Downtime</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.record_date ? format(new Date(r.record_date), 'dd MMM yyyy') : '—'}</td>
                  <td className="font-mono text-xs">{r.mr_no || '—'}</td>
                  <td>{r.plant_name || '—'}</td>
                  <td className="max-w-[150px] truncate" title={r.equipment_name || ''}>{r.equipment_name || '—'}</td>
                  <td>{r.artisan_name || '—'}</td>
                  <td>{r.created_by_user_name || '—'}</td>
                  <td className="max-w-[200px] truncate" title={r.issue_description || ''}>{r.issue_description || '—'}</td>
                  <td className="font-medium text-orange-600">{fmtMins(r.downtime_minutes)}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
              {records.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-8">
                    No records match the selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total} records
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button
              className="btn-secondary"
              onClick={() => setPage(p => Math.min(Math.ceil(total / PAGE_SIZE) - 1, p + 1))}
              disabled={page >= Math.ceil(total / PAGE_SIZE) - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
