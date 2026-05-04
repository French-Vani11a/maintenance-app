import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { createRecord, getEquipment, getPlants, getRecord, updateRecord } from '../services/api'
import type { Equipment, Plant } from '../types'
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
  arrival_time: string
  finishing_time: string
  downtime_minutes: string
  remarks: string
  status: string
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
  issue_description: '',
  arrival_time: '',
  finishing_time: '',
  downtime_minutes: '0',
  remarks: '',
  status: 'open',
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
  const [plants, setPlants] = useState<Plant[]>([])
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([])
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getPlants().then(setPlants)
    getEquipment().then((result) => {
      setAllEquipment(result.equipment)
      setFilteredEquipment(result.equipment)
    })
  }, [])

  useEffect(() => {
    if (!isEdit) return
    getRecord(Number(id))
      .then((r) => {
        setForm({
          record_date: r.record_date ? r.record_date.slice(0, 10) : '',
          time_reported: r.time_reported || '',
          reporter_name: r.reporter_name || '',
          reported_to: r.reported_to || '',
          artisan_name: r.artisan_name || '',
          mr_no: r.mr_no || '',
          plant_id: r.plant_id ? String(r.plant_id) : '',
          equipment_id: r.equipment_id ? String(r.equipment_id) : '',
          issue_description: r.issue_description || '',
          arrival_time: r.arrival_time || '',
          finishing_time: r.finishing_time || '',
          downtime_minutes: String(r.downtime_minutes ?? 0),
          remarks: r.remarks || '',
          status: r.status || 'open',
        })
      })
      .finally(() => setLoading(false))
  }, [id, isEdit])

  // Filter equipment when plant changes
  useEffect(() => {
    if (form.plant_id) {
      setFilteredEquipment(allEquipment.filter((e) => String(e.plant_id) === form.plant_id))
    } else {
      setFilteredEquipment(allEquipment)
    }
  }, [form.plant_id, allEquipment])

  // Auto-calculate downtime when times change
  useEffect(() => {
    if (form.arrival_time && form.finishing_time) {
      const mins = calcDowntime(form.arrival_time, form.finishing_time)
      if (mins !== null) setForm((f) => ({ ...f, downtime_minutes: String(mins) }))
    }
  }, [form.arrival_time, form.finishing_time])

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
        issue_description: form.issue_description || null,
        arrival_time: form.arrival_time || null,
        finishing_time: form.finishing_time || null,
        downtime_minutes: Number(form.downtime_minutes) || 0,
        remarks: form.remarks || null,
        status: form.status,
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
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldWrapper label="Status">
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          </FieldWrapper>
          <FieldWrapper label="Reporter">
            <input type="text" className="input" value={form.reporter_name} onChange={(e) => set('reporter_name', e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Reported To">
            <input type="text" className="input" value={form.reported_to} onChange={(e) => set('reported_to', e.target.value)} />
          </FieldWrapper>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Plant & Equipment</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Plant">
            <select
              className="input"
              value={form.plant_id}
              onChange={(e) => { set('plant_id', e.target.value); set('equipment_id', '') }}
            >
              <option value="">— Select plant —</option>
              {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FieldWrapper>
          <FieldWrapper label="Equipment">
            <select className="input" value={form.equipment_id} onChange={(e) => set('equipment_id', e.target.value)}>
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
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Timing</h3>
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
        </div>
        <p className="text-xs text-gray-400">
          Downtime auto-calculates from arrival and finishing times, but manual input will override it.
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
