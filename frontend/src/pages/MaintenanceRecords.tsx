import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { deleteRecord, getEquipment, getEquipmentGroups, getPlants, getRecord, getRecords, updateRecord } from '../services/api'
import type { Equipment, EquipmentGroup, MaintenanceRecord, Plant, RecordFilters } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'

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

function fmtHrs(hrs: number | null) {
  if (hrs == null || hrs === 0) return '—'
  return `${hrs} hrs`
}

function calcDowntime(arrival: string, finishing: string): number | null {
  const parse = (t: string) => { const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + m }
  const a = parse(arrival); const f = parse(finishing)
  if (a === null || f === null) return null
  return f >= a ? f - a : 24 * 60 - a + f
}

function InfoField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm text-gray-800">{value ?? '—'}</p>
    </div>
  )
}

interface ModalForm {
  record_date: string; time_reported: string; reporter_name: string; reported_to: string
  artisan_name: string; mr_no: string; plant_id: string; equipment_group_id: string
  equipment_id: string; issue_description: string; arrival_time: string; finishing_time: string
  downtime_minutes: string; run_time_minutes: string; prev_hr_meter: string; curr_hr_meter: string; loaves_sliced: string
  remarks: string; status: string; record_type: string
}

const EMPTY_MODAL_FORM: ModalForm = {
  record_date: '', time_reported: '', reporter_name: '', reported_to: '', artisan_name: '',
  mr_no: '', plant_id: '', equipment_group_id: '', equipment_id: '', issue_description: '',
  arrival_time: '', finishing_time: '', downtime_minutes: '0', run_time_minutes: '',
  prev_hr_meter: '', curr_hr_meter: '', loaves_sliced: '', remarks: '', status: 'open', record_type: 'regular',
}

export default function MaintenanceRecords() {
  const location = useLocation()
  const { user } = useAuth()
  const isViewer = user?.role === 'viewer'
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const [plants, setPlants] = useState<Plant[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [groups, setGroups] = useState<EquipmentGroup[]>([])

  const [filters, setFilters] = useState<RecordFilters>({})
  const [search, setSearch] = useState('')

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })
  function askConfirm(title: string, message: string, onConfirm: () => void) {
    setConfirmDialog({ open: true, title, message, onConfirm })
  }
  function closeConfirm() { setConfirmDialog(s => ({ ...s, open: false })) }

  // Modal state
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null)
  const [modalEditing, setModalEditing] = useState(false)
  const [modalForm, setModalForm] = useState<ModalForm>({ ...EMPTY_MODAL_FORM })
  const [modalIsSlicer, setModalIsSlicer] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    getPlants().then(setPlants)
    getEquipment().then(result => setEquipment(result.equipment))
    getEquipmentGroups().then(setGroups)
    const recordId = (location.state as any)?.openRecordId
    if (recordId) {
      getRecord(Number(recordId)).then(openModal).catch(() => {})
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    getRecords({ ...filters, search: search || undefined, skip: page * PAGE_SIZE, limit: PAGE_SIZE })
      .then(({ total, records }) => { setTotal(total); setRecords(records) })
      .finally(() => setLoading(false))
  }, [filters, search, page])

  // Cascade-filtered lists for modal edit form
  const modalGroups = modalForm.plant_id ? groups.filter(g => String(g.plant_id) === modalForm.plant_id) : []
  const modalEquipment = modalForm.plant_id
    ? equipment.filter(e => String(e.plant_id) === modalForm.plant_id &&
        (!modalForm.equipment_group_id || String(e.equipment_group_id) === modalForm.equipment_group_id))
    : []

  function setM(field: keyof ModalForm, value: string) {
    setModalForm(f => {
      const next = { ...f, [field]: value }
      if (field === 'plant_id') { next.equipment_group_id = ''; next.equipment_id = '' }
      if (field === 'equipment_group_id') { next.equipment_id = '' }
      if (field === 'arrival_time' || field === 'finishing_time') {
        const dt = calcDowntime(
          field === 'arrival_time' ? value : f.arrival_time,
          field === 'finishing_time' ? value : f.finishing_time
        )
        if (dt !== null) next.downtime_minutes = String(dt)
      }
      return next
    })
  }

  useEffect(() => {
    if (!modalIsSlicer || !modalForm.prev_hr_meter || !modalForm.curr_hr_meter) return
    const prev = parseFloat(modalForm.prev_hr_meter)
    const curr = parseFloat(modalForm.curr_hr_meter)
    if (!isNaN(prev) && !isNaN(curr) && curr >= prev) {
      setModalForm(f => ({ ...f, run_time_minutes: (curr - prev).toFixed(2) }))
    }
  }, [modalIsSlicer, modalForm.prev_hr_meter, modalForm.curr_hr_meter])

  function openModal(record: MaintenanceRecord) {
    setSelectedRecord(record)
    setModalEditing(false)
    setModalError('')
    setModalIsSlicer(record.is_slicer ?? false)
    setModalForm({
      record_date: record.record_date ? record.record_date.slice(0, 10) : '',
      time_reported: record.time_reported || '',
      reporter_name: record.reporter_name || '',
      reported_to: record.reported_to || '',
      artisan_name: record.artisan_name || '',
      mr_no: record.mr_no || '',
      plant_id: record.plant_id ? String(record.plant_id) : '',
      equipment_group_id: record.equipment_group_id ? String(record.equipment_group_id) : '',
      equipment_id: record.equipment_id ? String(record.equipment_id) : '',
      issue_description: record.issue_description || '',
      arrival_time: record.arrival_time || '',
      finishing_time: record.finishing_time || '',
      downtime_minutes: String(record.downtime_minutes ?? 0),
      run_time_minutes: record.run_time_minutes != null ? String(record.run_time_minutes) : '',
      prev_hr_meter: record.prev_hr_meter != null ? String(record.prev_hr_meter) : '',
      curr_hr_meter: record.curr_hr_meter != null ? String(record.curr_hr_meter) : '',
      loaves_sliced: record.loaves_sliced != null ? String(record.loaves_sliced) : '',
      remarks: record.remarks || '',
      status: record.status || 'open',
      record_type: record.record_type || 'regular',
    })
  }

  function closeModal() {
    setSelectedRecord(null)
    setModalEditing(false)
    setModalError('')
  }

  async function handleModalSave() {
    if (!selectedRecord) return
    setModalSaving(true)
    setModalError('')
    try {
      const payload = {
        record_date: new Date(modalForm.record_date).toISOString(),
        time_reported: modalForm.time_reported || null,
        reporter_name: modalForm.reporter_name || null,
        reported_to: modalForm.reported_to || null,
        artisan_name: modalForm.artisan_name || null,
        mr_no: modalForm.mr_no || null,
        plant_id: modalForm.plant_id ? Number(modalForm.plant_id) : null,
        equipment_id: modalForm.equipment_id ? Number(modalForm.equipment_id) : null,
        equipment_group_id: modalForm.equipment_group_id ? Number(modalForm.equipment_group_id) : null,
        issue_description: modalForm.issue_description || null,
        arrival_time: modalForm.arrival_time || null,
        finishing_time: modalForm.finishing_time || null,
        downtime_minutes: Number(modalForm.downtime_minutes) || 0,
        run_time_minutes: modalForm.run_time_minutes ? Number(modalForm.run_time_minutes) : null,
        is_slicer: modalIsSlicer,
        prev_hr_meter: modalIsSlicer && modalForm.prev_hr_meter ? parseFloat(modalForm.prev_hr_meter) : null,
        curr_hr_meter: modalIsSlicer && modalForm.curr_hr_meter ? parseFloat(modalForm.curr_hr_meter) : null,
        loaves_sliced: modalIsSlicer && modalForm.loaves_sliced ? parseInt(modalForm.loaves_sliced) : null,
        remarks: modalForm.remarks || null,
        status: modalForm.status,
        record_type: modalForm.record_type,
      }
      const updated = await updateRecord(selectedRecord.id, payload)
      setRecords(prev => prev.map(r => r.id === selectedRecord.id ? updated : r))
      setSelectedRecord(updated)
      setModalEditing(false)
    } catch (e: any) {
      setModalError(e?.response?.data?.detail || 'Failed to save record')
    } finally {
      setModalSaving(false)
    }
  }

  function handleFilterChange(key: keyof RecordFilters, value: string) {
    setPage(0)
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value || undefined }
      if (key === 'plant_id') newFilters.equipment_group_id = undefined
      return newFilters
    })
  }

  function handleDelete(id: number) {
    askConfirm('Delete Record', 'This maintenance record will be permanently deleted. This cannot be undone.', async () => {
      closeConfirm()
      await deleteRecord(id)
      setRecords(prev => prev.filter(r => r.id !== id))
      setTotal(t => t - 1)
      if (selectedRecord?.id === id) closeModal()
    })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" className="input pl-9 w-56" placeholder="Search records…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="input w-36" value={filters.date_from || ''}
            onChange={(e) => handleFilterChange('date_from', e.target.value)} />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" className="input w-36" value={filters.date_to || ''}
            onChange={(e) => handleFilterChange('date_to', e.target.value)} />
        </div>
        <select className="input w-40" value={filters.plant_id || ''} onChange={(e) => handleFilterChange('plant_id', e.target.value)}>
          <option value="">All Plants</option>
          {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input w-44" value={filters.equipment_group_id || ''} onChange={(e) => handleFilterChange('equipment_group_id', e.target.value)}>
          <option value="">{filters.plant_id ? 'All Groups' : 'No plant selected'}</option>
          {filters.plant_id ? groups.filter(g => g.plant_id === Number(filters.plant_id)).map(g =>
            <option key={g.id} value={g.id}>{g.name}</option>) : null}
        </select>
        <select className="input w-36" value={filters.status || ''} onChange={(e) => handleFilterChange('status', e.target.value)}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <select className="input w-36" value={filters.record_type || ''} onChange={(e) => handleFilterChange('record_type', e.target.value)}>
          <option value="">All Types</option>
          <option value="regular">Regular</option>
          <option value="breakdown">Breakdown</option>
        </select>
        <input type="text" className="input w-40" placeholder="Filter MR No" value={filters.mr_no || ''}
          onChange={(e) => handleFilterChange('mr_no', e.target.value)} />
        <input type="text" className="input w-40" placeholder="Filter Artisan" value={filters.artisan_name || ''}
          onChange={(e) => handleFilterChange('artisan_name', e.target.value)} />
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
          <div className="flex h-48 items-center justify-center bg-white"><LoadingSpinner size="lg" /></div>
        ) : records.length === 0 ? (
          <div className="flex h-48 items-center justify-center bg-white text-gray-400 text-sm">No records found</div>
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
                <th>Downtime</th>
                <th>Run Time</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                  onClick={() => openModal(r)}>
                  <td className="text-gray-500">{r.record_date ? format(new Date(r.record_date), 'dd MMM yyyy') : '—'}</td>
                  <td className="font-mono text-xs">{r.mr_no || '—'}</td>
                  <td>{r.plant_name || '—'}</td>
                  <td className="max-w-[160px] truncate" title={r.equipment_name || undefined}>{r.equipment_name || '—'}</td>
                  <td className="max-w-[200px] truncate" title={r.issue_description || undefined}>{r.issue_description || '—'}</td>
                  <td>{r.artisan_name || '—'}</td>
                  <td className="text-orange-600 font-medium">{fmtMins(r.downtime_minutes)}</td>
                  <td className="text-blue-600 font-medium">{fmtHrs(r.run_time_minutes)}</td>
                  <td>
                    <span className={`badge ${r.record_type === 'breakdown' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                      {r.record_type === 'breakdown' ? 'Breakdown' : 'Regular'}
                    </span>
                  </td>
                  <td><StatusBadge status={r.status} /></td>
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
            <button className="btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm text-gray-600">{page + 1} / {totalPages}</span>
            <button className="btn-secondary btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Record Details Modal ── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={closeModal}>
          <div className="card w-full max-w-4xl my-8 space-y-5" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {selectedRecord.mr_no || 'Maintenance Record'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedRecord.record_date ? format(new Date(selectedRecord.record_date), 'dd MMM yyyy') : '—'}
                  {selectedRecord.created_by_user_name ? ` · Created by ${selectedRecord.created_by_user_name}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!modalEditing && !isViewer && (
                  <>
                    <button title="Edit" onClick={() => { setModalEditing(true); setModalError('') }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button title="Delete" onClick={() => handleDelete(selectedRecord.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button onClick={closeModal}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors ml-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {modalError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{modalError}</div>
            )}

            {/* ── VIEW MODE ── */}
            {!modalEditing && (
              <div className="space-y-5 border-t pt-4">
                {/* Status + Type row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge status={selectedRecord.status} />
                  <span className={`badge ${selectedRecord.record_type === 'breakdown' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                    {selectedRecord.record_type === 'breakdown' ? 'Breakdown' : 'Regular'}
                  </span>
                  {selectedRecord.is_slicer && (
                    <span className="badge bg-blue-100 text-blue-800">Slicer</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
                  <InfoField label="Date" value={selectedRecord.record_date ? format(new Date(selectedRecord.record_date), 'dd MMM yyyy') : null} />
                  <InfoField label="Time Reported" value={selectedRecord.time_reported} />
                  <InfoField label="MR Number" value={selectedRecord.mr_no} />
                  <InfoField label="Plant" value={selectedRecord.plant_name} />
                  <InfoField label="Equipment Group" value={selectedRecord.equipment_group_name} />
                  <InfoField label="Equipment" value={selectedRecord.equipment_name} />
                  <InfoField label="Artisan" value={selectedRecord.artisan_name} />
                  <InfoField label="Reporter" value={selectedRecord.reporter_name} />
                  <InfoField label="Reported To" value={selectedRecord.reported_to} />
                  <InfoField label="Arrival Time" value={selectedRecord.arrival_time} />
                  <InfoField label="Finishing Time" value={selectedRecord.finishing_time} />
                  <InfoField label="Downtime" value={fmtMins(selectedRecord.downtime_minutes)} />
                  <InfoField label="Run Time" value={fmtHrs(selectedRecord.run_time_minutes)} />
                  {selectedRecord.is_slicer && (
                    <>
                      <InfoField label="Previous Hr Meter" value={selectedRecord.prev_hr_meter != null ? String(selectedRecord.prev_hr_meter) : null} />
                      <InfoField label="Current Hr Meter" value={selectedRecord.curr_hr_meter != null ? String(selectedRecord.curr_hr_meter) : null} />
                      <InfoField label="Loaves Sliced" value={selectedRecord.loaves_sliced != null ? String(selectedRecord.loaves_sliced) : null} />
                    </>
                  )}
                  <InfoField label="Created By" value={selectedRecord.created_by_user_name} />
                </div>

                {selectedRecord.issue_description && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Issue Description</p>
                    <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{selectedRecord.issue_description}</p>
                  </div>
                )}
                {selectedRecord.remarks && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Remarks</p>
                    <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{selectedRecord.remarks}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── EDIT MODE ── */}
            {modalEditing && (
              <div className="space-y-5 border-t pt-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="label">Date *</label>
                    <input type="date" className="input" value={modalForm.record_date} onChange={e => setM('record_date', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Time Reported</label>
                    <input type="time" className="input" value={modalForm.time_reported} onChange={e => setM('time_reported', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">MR Number</label>
                    <input type="text" className="input" value={modalForm.mr_no} onChange={e => setM('mr_no', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Status</label>
                    <select className="input" value={modalForm.status} onChange={e => setM('status', e.target.value)}>
                      <option value="open">Open</option>
                      <option value="in-progress">In Progress</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="label">Record Type</label>
                    <div className="flex items-center gap-5 h-10">
                      {(['regular', 'breakdown'] as const).map(t => (
                        <label key={t} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="modal_record_type" value={t} checked={modalForm.record_type === t}
                            onChange={() => setM('record_type', t)} className="h-4 w-4 accent-blue-600" />
                          <span className={`text-sm font-medium ${t === 'breakdown' ? 'text-red-700' : 'text-gray-700'}`}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="label">Reporter</label>
                    <input type="text" className="input" value={modalForm.reporter_name} onChange={e => setM('reporter_name', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Reported To</label>
                    <input type="text" className="input" value={modalForm.reported_to} onChange={e => setM('reported_to', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Plant</label>
                    <select className="input" value={modalForm.plant_id} onChange={e => setM('plant_id', e.target.value)}>
                      <option value="">— Select plant —</option>
                      {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="label">Equipment Group</label>
                    <select className="input" value={modalForm.equipment_group_id} disabled={!modalForm.plant_id}
                      onChange={e => setM('equipment_group_id', e.target.value)}>
                      <option value="">— Select group —</option>
                      {modalGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="label">Equipment</label>
                    <select className="input" value={modalForm.equipment_id} disabled={!modalForm.plant_id}
                      onChange={e => setM('equipment_id', e.target.value)}>
                      <option value="">— Select equipment —</option>
                      {modalEquipment.map(e => <option key={e.id} value={e.id}>{e.equipment_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="label">Artisan</label>
                    <input type="text" className="input" value={modalForm.artisan_name} onChange={e => setM('artisan_name', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Arrival Time</label>
                    <input type="time" className="input" value={modalForm.arrival_time} onChange={e => setM('arrival_time', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Finishing Time</label>
                    <input type="time" className="input" value={modalForm.finishing_time} onChange={e => setM('finishing_time', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Downtime (min)</label>
                    <input type="number" min="0" className="input" value={modalForm.downtime_minutes}
                      onChange={e => setM('downtime_minutes', e.target.value)} />
                  </div>
                  <div className="space-y-1 flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer select-none h-10">
                      <input
                        type="checkbox"
                        checked={modalIsSlicer}
                        onChange={e => setModalIsSlicer(e.target.checked)}
                        className="h-4 w-4 rounded accent-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Is Slicer</span>
                    </label>
                  </div>
                  {modalIsSlicer && (
                    <>
                      <div className="space-y-1">
                        <label className="label">Previous Hr Meter</label>
                        <input type="number" min="0" step="0.01" className="input" placeholder="e.g. 1000.00"
                          value={modalForm.prev_hr_meter} onChange={e => setM('prev_hr_meter', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="label">Current Hr Meter</label>
                        <input type="number" min="0" step="0.01" className="input" placeholder="e.g. 1002.50"
                          value={modalForm.curr_hr_meter} onChange={e => setM('curr_hr_meter', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="label">Loaves Sliced</label>
                        <input type="number" min="0" className="input" placeholder="e.g. 5000"
                          value={modalForm.loaves_sliced} onChange={e => setM('loaves_sliced', e.target.value)} />
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <label className="label">Run Time (hours)</label>
                    <input type="number" min="0" step="0.01" className="input" value={modalForm.run_time_minutes}
                      onChange={e => setM('run_time_minutes', e.target.value)} />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <label className="label">Issue Description</label>
                    <textarea className="input resize-none" rows={3} value={modalForm.issue_description}
                      onChange={e => setM('issue_description', e.target.value)} />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <label className="label">Remarks</label>
                    <textarea className="input resize-none" rows={2} value={modalForm.remarks}
                      onChange={e => setM('remarks', e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleModalSave} disabled={modalSaving} className="btn-primary flex items-center gap-1.5">
                    {modalSaving ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                    Save Changes
                  </button>
                  <button onClick={() => { setModalEditing(false); setModalError('') }} className="btn-secondary">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  )
}
