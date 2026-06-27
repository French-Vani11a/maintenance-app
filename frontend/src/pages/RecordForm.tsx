import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { createRecord, getEquipment, getEquipmentGroups, getPlants, getRecord, updateRecord } from '../services/api'
import type { Equipment, EquipmentGroup, Plant } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'

const STATUS_OPTIONS = ['open', 'in-progress', 'closed']

interface FieldWrapperProps {
  label: string
  children: React.ReactNode
}

function FieldWrapper({ label, children }: FieldWrapperProps) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

interface FormState {
  record_date: string
  time_reported: string
  reporter_name: string
  reported_to: string
  artisan_name: string
  mr_no: string
  plant_id: string
  equipment_id: string
  issue_description: string
  equipment_group_id: string
  arrival_time: string
  finishing_time: string
  downtime_minutes: string
  run_time_minutes: string
  prev_hr_meter: string
  curr_hr_meter: string
  loaves_sliced: string
  remarks: string
  status: string
  record_type: string
}

const empty: FormState = {
  record_date: new Date().toISOString().slice(0, 10),
  time_reported: '',
  reporter_name: '',
  reported_to: '',
  artisan_name: '',
  mr_no: '',
  plant_id: '',
  equipment_id: '',
  equipment_group_id: '',
  issue_description: '',
  arrival_time: '',
  finishing_time: '',
  downtime_minutes: '0',
  run_time_minutes: '',
  prev_hr_meter: '',
  curr_hr_meter: '',
  loaves_sliced: '',
  remarks: '',
  status: 'open',
  record_type: 'regular',
}

/** Compute minutes between two HH:MM strings */
function calcDowntime(arrival: string, finishing: string): number | null {
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return isNaN(h) ? null : h * 60 + m
  }
  const a = parse(arrival)
  const f = parse(finishing)
  if (a === null || f === null) return null
  return f >= a ? f - a : 24 * 60 - a + f // crosses midnight
}

export default function RecordForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState<FormState>(empty)
  const [isSlicer, setIsSlicer] = useState(false)
  const [plants, setPlants] = useState<Plant[]>([])
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([])
  const [equipmentGroups, setEquipmentGroups] = useState<EquipmentGroup[]>([])
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([])
  const [filteredGroups, setFilteredGroups] = useState<EquipmentGroup[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getPlants().then(setPlants)
    getEquipment({ skip: 0, limit: 10000 }).then((result) => {
      setAllEquipment(result.equipment)
      setFilteredEquipment(result.equipment)
    })
    getEquipmentGroups().then((result) => {
      setEquipmentGroups(result)
      setFilteredGroups(result)
    })
  }, [])

  useEffect(() => {
    if (!isEdit) return
    getRecord(Number(id))
      .then((r) => {
        setIsSlicer(r.is_slicer ?? false)
        setForm({
          record_date: r.record_date ? r.record_date.slice(0, 10) : '',
          time_reported: r.time_reported || '',
          reporter_name: r.reporter_name || '',
          reported_to: r.reported_to || '',
          artisan_name: r.artisan_name || '',
          mr_no: r.mr_no || '',
          plant_id: r.plant_id ? String(r.plant_id) : '',
          equipment_id: r.equipment_id ? String(r.equipment_id) : '',
          equipment_group_id: r.equipment_group_id ? String(r.equipment_group_id) : '',
          issue_description: r.issue_description || '',
          arrival_time: r.arrival_time || '',
          finishing_time: r.finishing_time || '',
          downtime_minutes: String(r.downtime_minutes ?? 0),
          run_time_minutes: r.run_time_minutes != null ? String(r.run_time_minutes) : '',
          prev_hr_meter: r.prev_hr_meter != null ? String(r.prev_hr_meter) : '',
          curr_hr_meter: r.curr_hr_meter != null ? String(r.curr_hr_meter) : '',
          loaves_sliced: r.loaves_sliced != null ? String(r.loaves_sliced) : '',
          remarks: r.remarks || '',
          status: r.status || 'open',
          record_type: r.record_type || 'regular',
        })
      })
      .finally(() => setLoading(false))
  }, [id, isEdit])

  // Filter equipment and groups when plant or group changes
  useEffect(() => {
    if (form.plant_id) {
      // Filter groups by plant
      setFilteredGroups(equipmentGroups.filter((g) => String(g.plant_id) === form.plant_id))

      // Filter equipment by plant and optionally by group
      let equipmentForPlant = allEquipment.filter((e) => String(e.plant_id) === form.plant_id)
      if (form.equipment_group_id) {
        equipmentForPlant = equipmentForPlant.filter((e) => String(e.equipment_group_id) === form.equipment_group_id)
      }
      setFilteredEquipment(equipmentForPlant)
    } else {
      // No plant selected - show no equipment or groups
      setFilteredEquipment([])
      setFilteredGroups([])
    }
  }, [form.plant_id, form.equipment_group_id, allEquipment, equipmentGroups])

  // Auto-calculate downtime when times change
  useEffect(() => {
    if (form.arrival_time && form.finishing_time) {
      const mins = calcDowntime(form.arrival_time, form.finishing_time)
      if (mins !== null) setForm((f) => ({ ...f, downtime_minutes: String(mins) }))
    }
  }, [form.arrival_time, form.finishing_time])

  // Auto-calculate run time from hr meter readings when slicer mode is active
  useEffect(() => {
    if (!isSlicer || !form.prev_hr_meter || !form.curr_hr_meter) return
    const prev = parseFloat(form.prev_hr_meter)
    const curr = parseFloat(form.curr_hr_meter)
    if (!isNaN(prev) && !isNaN(curr) && curr >= prev) {
      setForm((f) => ({ ...f, run_time_minutes: (curr - prev).toFixed(2) }))
    }
  }, [isSlicer, form.prev_hr_meter, form.curr_hr_meter])

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        record_date: new Date(form.record_date).toISOString(),
        time_reported: form.time_reported || null,
        reporter_name: form.reporter_name || null,
        reported_to: form.reported_to || null,
        artisan_name: form.artisan_name || null,
        mr_no: form.mr_no || null,
        plant_id: form.plant_id ? Number(form.plant_id) : null,
        equipment_id: form.equipment_id ? Number(form.equipment_id) : null,
        equipment_group_id: form.equipment_group_id ? Number(form.equipment_group_id) : null,
        issue_description: form.issue_description || null,
        arrival_time: form.arrival_time || null,
        finishing_time: form.finishing_time || null,
        downtime_minutes: Number(form.downtime_minutes) || 0,
        run_time_minutes: form.run_time_minutes ? Number(form.run_time_minutes) : null,
        is_slicer: isSlicer,
        prev_hr_meter: isSlicer && form.prev_hr_meter ? parseFloat(form.prev_hr_meter) : null,
        curr_hr_meter: isSlicer && form.curr_hr_meter ? parseFloat(form.curr_hr_meter) : null,
        loaves_sliced: isSlicer && form.loaves_sliced ? parseInt(form.loaves_sliced) : null,
        remarks: form.remarks || null,
        status: form.status,
        record_type: form.record_type,
      }

      if (isEdit) {
        await updateRecord(Number(id), payload)
      } else {
        await createRecord(payload)
      }
      navigate('/records')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save record')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary btn-sm">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h2 className="text-base font-semibold text-gray-700">
          {isEdit ? 'Edit Record' : 'New Maintenance Record'}
        </h2>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Basic Info</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldWrapper label="Date *">
            <input type="date" className="input" required value={form.record_date} onChange={(e) => set('record_date', e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Time Reported">
            <input type="time" className="input" value={form.time_reported} onChange={(e) => set('time_reported', e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="MR Number">
            <input type="text" className="input" placeholder="e.g. MR-0123" value={form.mr_no} onChange={(e) => set('mr_no', e.target.value)} />
          </FieldWrapper>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <FieldWrapper label="Status">
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          </FieldWrapper>
          <FieldWrapper label="Record Type">
            <div className="flex items-center gap-6 h-10">
              {(['regular', 'breakdown'] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="record_type"
                    value={type}
                    checked={form.record_type === type}
                    onChange={() => set('record_type', type)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  <span className={`text-sm font-medium ${type === 'breakdown' ? 'text-red-700' : 'text-gray-700'}`}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </FieldWrapper>
          <FieldWrapper label="Reporter">
            <input type="text" className="input" value={form.reporter_name} onChange={(e) => set('reporter_name', e.target.value)} />
          </FieldWrapper>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldWrapper label="Reported To">
            <input type="text" className="input" value={form.reported_to} onChange={(e) => set('reported_to', e.target.value)} />
          </FieldWrapper>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Plant & Equipment</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldWrapper label="Plant">
            <select
              className="input"
              value={form.plant_id}
              onChange={(e) => { set('plant_id', e.target.value); set('equipment_id', ''); set('equipment_group_id', '') }}
            >
              <option value="">— Select plant —</option>
              {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FieldWrapper>
          <FieldWrapper label="Equipment Group">
            <select className="input" value={form.equipment_group_id} onChange={(e) => { set('equipment_group_id', e.target.value); set('equipment_id', '') }}>
              <option value="">— Select equipment group —</option>
              {filteredGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </FieldWrapper>
          <FieldWrapper label="Equipment *">
            <select className="input" required value={form.equipment_id} onChange={(e) => set('equipment_id', e.target.value)}>
              <option value="">— Select equipment —</option>
              {filteredEquipment.map((e) => (
                <option key={e.id} value={e.id}>{e.equipment_name}</option>
              ))}
            </select>
          </FieldWrapper>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Fault Details</h3>
        <FieldWrapper label="Issue Description *">
          <textarea
            className="input resize-none"
            rows={3}
            required
            value={form.issue_description}
            onChange={(e) => set('issue_description', e.target.value)}
          />
        </FieldWrapper>
        <FieldWrapper label="Artisan">
          <input type="text" className="input" value={form.artisan_name} onChange={(e) => set('artisan_name', e.target.value)} />
        </FieldWrapper>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Timing</h3>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isSlicer}
              onChange={(e) => setIsSlicer(e.target.checked)}
              className="h-4 w-4 rounded accent-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">Is Slicer</span>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldWrapper label="Arrival Time">
            <input type="time" className="input" value={form.arrival_time} onChange={(e) => set('arrival_time', e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Finishing Time">
            <input type="time" className="input" value={form.finishing_time} onChange={(e) => set('finishing_time', e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Downtime (minutes)">
            <input
              type="number"
              min="0"
              className="input"
              value={form.downtime_minutes}
              onChange={(e) => set('downtime_minutes', e.target.value)}
            />
          </FieldWrapper>
          {isSlicer && (
            <>
              <FieldWrapper label="Previous Hr Meter">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  placeholder="e.g. 1000.00"
                  value={form.prev_hr_meter}
                  onChange={(e) => set('prev_hr_meter', e.target.value)}
                />
              </FieldWrapper>
              <FieldWrapper label="Current Hr Meter">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  placeholder="e.g. 1002.50"
                  value={form.curr_hr_meter}
                  onChange={(e) => set('curr_hr_meter', e.target.value)}
                />
              </FieldWrapper>
              <FieldWrapper label="Loaves Sliced">
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder="e.g. 5000"
                  value={form.loaves_sliced}
                  onChange={(e) => set('loaves_sliced', e.target.value)}
                />
              </FieldWrapper>
            </>
          )}
          <FieldWrapper label="Run Time (hours)">
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.run_time_minutes}
              onChange={(e) => set('run_time_minutes', e.target.value)}
            />
          </FieldWrapper>
        </div>
        <p className="text-xs text-gray-400">
          Downtime auto-calculates from arrival and finishing times.
          {isSlicer && ' Run time auto-calculates from current minus previous hr meter (in hours), but can be overridden.'}
        </p>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Remarks</h3>
        <textarea
          className="input resize-none"
          rows={3}
          value={form.remarks}
          onChange={(e) => set('remarks', e.target.value)}
          placeholder="Additional notes…"
        />
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <LoadingSpinner size="sm" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : isEdit ? 'Update Record' : 'Create Record'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => navigate('/records')}>
          Cancel
        </button>
      </div>
    </form>
  )
}
