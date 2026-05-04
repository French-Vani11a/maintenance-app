import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { deleteRecord, getEquipment, getEquipmentGroups, getPlants, getRecords } from '../services/api'
import type { Equipment, EquipmentGroup, MaintenanceRecord, Plant, RecordFilters } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'

const PAGE_SIZE = 50

function StatusBadge({ status }: { status: string }) {
  if (status === 'closed') return <span className="badge-closed">Closed</span>
  if (status === 'in-progress') return <span className="badge-in-progress">In Progress</span>
  return <span className="badge-open">Open</span>
}

function fmtMins(mins: number | null) {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function MaintenanceRecords() {
  const navigate = useNavigate()

  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const [plants, setPlants] = useState<Plant[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [groups, setGroups] = useState<EquipmentGroup[]>([])

  const [filters, setFilters] = useState<RecordFilters>({})
  const [search, setSearch] = useState('')

  // Load reference data once
  useEffect(() => {
    getPlants().then(setPlants)
    getEquipment().then(result => setEquipment(result.equipment))
    getEquipmentGroups().then(setGroups)
  }, [])

  useEffect(() => {
    setLoading(true)
    getRecords({ ...filters, search: search || undefined, skip: page * PAGE_SIZE, limit: PAGE_SIZE })
      .then(({ total, records }) => {
        setTotal(total)
        setRecords(records)
      })
      .finally(() => setLoading(false))
  }, [filters, search, page])

  function handleFilterChange(key: keyof RecordFilters, value: string) {
    setPage(0)
    setFilters((prev) => ({ ...prev, [key]: value || undefined }))
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this record?')) return
    await deleteRecord(id)
    setRecords((prev) => prev.filter((r) => r.id !== id))
    setTotal((t) => t - 1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="input pl-9 w-56"
            placeholder="Search records…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input w-36"
            value={filters.date_from || ''}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            className="input w-36"
            value={filters.date_to || ''}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
          />
        </div>

        {/* Plant filter */}
        <select
          className="input w-40"
          value={filters.plant_id || ''}
          onChange={(e) => handleFilterChange('plant_id', e.target.value)}
        >
          <option value="">All Plants</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Equipment Group filter */}
        <select
          className="input w-44"
          value={filters.equipment_group_id || ''}
          onChange={(e) => handleFilterChange('equipment_group_id', e.target.value)}
        >
          <option value="">All Groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          className="input w-36"
          value={filters.status || ''}
          onChange={(e) => handleFilterChange('status', e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>

        {/* MR No filter */}
        <input
          type="text"
          className="input w-40"
          placeholder="Filter MR No"
          value={filters.mr_no || ''}
          onChange={(e) => handleFilterChange('mr_no', e.target.value)}
        />

        {/* Artisan filter */}
        <input
          type="text"
          className="input w-40"
          placeholder="Filter Artisan"
          value={filters.artisan_name || ''}
          onChange={(e) => handleFilterChange('artisan_name', e.target.value)}
        />

        {/* Created by filter */}
        <input
          type="text"
          className="input w-44"
          placeholder="Filter created_by"
          value={filters.created_by || ''}
          onChange={(e) => handleFilterChange('created_by', e.target.value)}
        />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500">{total} records</span>
          <Link to="/records/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New Record
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div className="flex h-48 items-center justify-center bg-white">
            <LoadingSpinner size="lg" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex h-48 items-center justify-center bg-white text-gray-400 text-sm">
            No records found
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>MR No</th>
                <th>Plant</th>
                <th>Equipment</th>
                <th>Issue</th>
                <th>Artisan</th>
                <th>created_by</th>
                <th>Downtime</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="text-gray-500">
                    {r.record_date ? format(new Date(r.record_date), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="font-mono text-xs">{r.mr_no || '—'}</td>
                  <td>{r.plant_name || '—'}</td>
                  <td className="max-w-[160px] truncate" title={r.equipment_name || undefined}>
                    {r.equipment_name || '—'}
                  </td>
                  <td className="max-w-[200px] truncate" title={r.issue_description || undefined}>
                    {r.issue_description || '—'}
                  </td>
                  <td>{r.artisan_name || '—'}</td>
                  <td>{r.created_by_user_name || '—'}</td>
                  <td className="text-orange-600 font-medium">{fmtMins(r.downtime_minutes)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/records/${r.id}/edit`)}
                        className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              className="btn-secondary btn-sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm text-gray-600">
              {page + 1} / {totalPages}
            </span>
            <button
              className="btn-secondary btn-sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
