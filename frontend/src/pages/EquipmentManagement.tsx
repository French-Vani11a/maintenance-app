import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, Building2, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import {
  completeJobCard,
  createEquipment,
  createEquipmentGroup,
  createJobCard,
  createPlant,
  deleteEquipment,
  deleteEquipmentGroup,
  deletePlant,
  getEquipment,
  getEquipmentDetails,
  getEquipmentGroups,
  getJobCards,
  getPlants,
  updateEquipment,
  updateEquipmentGroup,
  updatePlant,
} from '../services/api'
import type {
  Equipment,
  EquipmentDetails,
  EquipmentGroup,
  Plant,
  ServiceJobCard,
} from '../types'
import LoadingSpinner from '../components/LoadingSpinner'

const EMPTY_EQUIP_FORM = {
  name: '',
  code: '',
  status: 'active',
  plant_id: null as number | null,
  equipment_group_id: null as number | null,
  last_service_date: '',
  service_interval_days: null as number | null,
  service_type: '',
  service_notes: '',
  manufacturer: '',
  model_number: '',
  description: '',
}

export default function EquipmentManagement() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [groups, setGroups] = useState<EquipmentGroup[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([])
  const [totalEquipment, setTotalEquipment] = useState(0)
  const [equipmentPage, setEquipmentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedPlant, setSelectedPlant] = useState<number | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [error, setError] = useState('')

  const EQUIPMENT_PAGE_SIZE = 50

  // Plant edit state
  const [editingPlant, setEditingPlant] = useState<number | null>(null)
  const [plantName, setPlantName] = useState('')
  const [newPlantName, setNewPlantName] = useState('')
  const [addingPlant, setAddingPlant] = useState(false)

  // Equipment group edit state
  const [editingGroup, setEditingGroup] = useState<number | null>(null)
  const [groupName, setGroupName] = useState('')
  const [groupPlantId, setGroupPlantId] = useState<number | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupPlantId, setNewGroupPlantId] = useState<number | null>(null)
  const [addingGroup, setAddingGroup] = useState(false)

  // Equipment edit state
  const [equipForm, setEquipForm] = useState({ ...EMPTY_EQUIP_FORM })
  const [newEquipForm, setNewEquipForm] = useState({ ...EMPTY_EQUIP_FORM })
  const [addingEquip, setAddingEquip] = useState(false)

  // Equipment Details modal state
  const [modalEditing, setModalEditing] = useState(false)

  const [detailsModal, setDetailsModal] = useState<EquipmentDetails | null>(null)
  const [detailsModalLoading, setDetailsModalLoading] = useState(false)
  const [detailsModalError, setDetailsModalError] = useState('')

  // Service job card form (inside details modal)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [serviceForm, setServiceForm] = useState({
    service_type: '',
    due_date: '',
    service_description: '',
    work_to_be_done: '',
    assigned_artisan: '',
    parts_required: '',
    priority: 'medium',
    notes: '',
  })
  const [serviceFormSaving, setServiceFormSaving] = useState(false)
  const [serviceFormSuccess, setServiceFormSuccess] = useState('')

  // Active job card for the currently viewed equipment
  const [equipmentActiveCard, setEquipmentActiveCard] = useState<ServiceJobCard | null>(null)

  // Completion form (shown when equipmentActiveCard exists)
  const [completeForm, setCompleteForm] = useState({
    service_date: '',
    performed_by: '',
    work_done: '',
    parts_used: '',
    completion_notes: '',
  })
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (!detailsModal) {
      setShowServiceForm(false)
      setServiceFormSuccess('')
      setEquipmentActiveCard(null)
      setCompleteForm({ service_date: '', performed_by: '', work_done: '', parts_used: '', completion_notes: '' })
    }
  }, [detailsModal])

  useEffect(() => {
    Promise.all([getPlants(), getEquipmentGroups()])
      .then(([p, g]) => {
        setPlants(p)
        setGroups(g)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadEquipment()
  }, [selectedPlant, selectedGroup, equipmentPage])

  async function loadEquipment() {
    try {
      const [result, allResult] = await Promise.all([
        getEquipment({
          plant_id: selectedPlant || undefined,
          equipment_group_id: selectedGroup || undefined,
          skip: equipmentPage * EQUIPMENT_PAGE_SIZE,
          limit: EQUIPMENT_PAGE_SIZE,
        }),
        getEquipment({ skip: 0, limit: 10000 }),
      ])
      setEquipment(result.equipment)
      setTotalEquipment(result.total)
      setAllEquipment(allResult.equipment)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load equipment')
    }
  }

  const visibleEquipment = equipment

  function calculateNextServiceDate(dateValue: string, interval: number | null) {
    if (!dateValue || !interval) return ''
    const parsed = new Date(dateValue)
    if (Number.isNaN(parsed.getTime())) return ''
    const nextDate = new Date(parsed)
    nextDate.setDate(nextDate.getDate() + interval)
    return nextDate.toISOString().slice(0, 10)
  }

  function calculateServiceStatus(dateValue: string, interval: number | null) {
    if (!dateValue || !interval) return 'Not Scheduled'
    const nextDate = calculateNextServiceDate(dateValue, interval)
    if (!nextDate) return 'Not Scheduled'
    const today = new Date().toISOString().slice(0, 10)
    if (nextDate < today) return 'Overdue'
    if (nextDate <= new Date(new Date().setDate(new Date().getDate() + 14)).toISOString().slice(0, 10)) return 'Due Soon'
    return 'On Schedule'
  }

  async function loadEquipmentActiveCard(equipmentId: number) {
    try {
      const res = await getJobCards({ equipment_id: equipmentId, limit: 20 })
      const active = res.job_cards.find((c) => c.status !== 'completed') ?? null
      setEquipmentActiveCard(active)
    } catch {
      setEquipmentActiveCard(null)
    }
  }

  async function openDetailsModal(equipmentId: number) {
    setDetailsModalLoading(true)
    setDetailsModalError('')
    setDetailsModal(null)
    try {
      const [details] = await Promise.all([
        getEquipmentDetails(equipmentId),
        loadEquipmentActiveCard(equipmentId),
      ])
      setDetailsModal(details)
    } catch (e: any) {
      setDetailsModalError(e?.response?.data?.detail || 'Failed to load equipment details')
      setDetailsModal({} as EquipmentDetails)
    } finally {
      setDetailsModalLoading(false)
    }
  }

  // ── Plants ────────────────────────────────────────────────────────────────

  async function handleCreatePlant() {
    if (!newPlantName.trim()) return
    try {
      const p = await createPlant(newPlantName.trim())
      setPlants((prev) => [...prev, p])
      setNewPlantName('')
      setAddingPlant(false)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create plant')
    }
  }

  async function handleUpdatePlant(id: number) {
    try {
      const p = await updatePlant(id, plantName)
      setPlants((prev) => prev.map((x) => (x.id === id ? p : x)))
      setEditingPlant(null)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to update plant')
    }
  }

  async function handleDeletePlant(id: number) {
    if (!confirm('Delete this plant? Equipment assigned to it will be unassigned.')) return
    try {
      await deletePlant(id)
      setPlants((prev) => prev.filter((p) => p.id !== id))
      if (selectedPlant === id) setSelectedPlant(null)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete plant')
    }
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return
    try {
      const group = await createEquipmentGroup({
        name: newGroupName.trim(),
        plant_id: newGroupPlantId,
      })
      setGroups((prev) => [...prev, group])
      setNewGroupName('')
      setNewGroupPlantId(null)
      setAddingGroup(false)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create group')
    }
  }

  async function handleUpdateGroup(id: number) {
    try {
      const group = await updateEquipmentGroup(id, {
        name: groupName,
        plant_id: groupPlantId,
      })
      setGroups((prev) => prev.map((x) => (x.id === id ? group : x)))
      setEditingGroup(null)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to update group')
    }
  }

  async function handleDeleteGroup(id: number) {
    if (!confirm('Delete this equipment group? Equipment assigned to it will be ungrouped.')) return
    try {
      await deleteEquipmentGroup(id)
      setGroups((prev) => prev.filter((g) => g.id !== id))
      if (selectedGroup === id) setSelectedGroup(null)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete group')
    }
  }

  // ── Equipment ─────────────────────────────────────────────────────────────

  async function handleCreateEquip() {
    if (!newEquipForm.name.trim()) return
    try {
      await createEquipment({
        equipment_name: newEquipForm.name.trim(),
        equipment_code: newEquipForm.code || null,
        plant_id: newEquipForm.plant_id,
        equipment_group_id: newEquipForm.equipment_group_id,
        status: newEquipForm.status,
        last_service_date: newEquipForm.last_service_date || null,
        service_interval_days: newEquipForm.service_interval_days,
        service_type: newEquipForm.service_type || null,
        service_notes: newEquipForm.service_notes || null,
        manufacturer: newEquipForm.manufacturer || null,
        model_number: newEquipForm.model_number || null,
        description: newEquipForm.description || null,
      })
      loadEquipment()
      setNewEquipForm({
        ...EMPTY_EQUIP_FORM,
        plant_id: selectedPlant,
        equipment_group_id: selectedGroup,
      })
      setAddingEquip(false)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create equipment')
    }
  }

  async function handleUpdateEquip(id: number) {
    try {
      await updateEquipment(id, {
        equipment_name: equipForm.name,
        equipment_code: equipForm.code || null,
        plant_id: equipForm.plant_id,
        equipment_group_id: equipForm.equipment_group_id,
        status: equipForm.status,
        last_service_date: equipForm.last_service_date || null,
        service_interval_days: equipForm.service_interval_days,
        service_type: equipForm.service_type || null,
        service_notes: equipForm.service_notes || null,
        manufacturer: equipForm.manufacturer || null,
        model_number: equipForm.model_number || null,
        description: equipForm.description || null,
      })
      loadEquipment()
      const updated = await getEquipmentDetails(id)
      setDetailsModal(updated)
      setModalEditing(false)
    } catch (e: any) {
      setDetailsModalError(e?.response?.data?.detail || 'Failed to update equipment')
    }
  }

  async function handleCreateJobCard() {
    if (!detailsModal?.id) return
    setServiceFormSaving(true)
    setDetailsModalError('')
    setServiceFormSuccess('')
    try {
      const card: ServiceJobCard = await createJobCard({
        equipment_id: detailsModal.id,
        plant_id: detailsModal.plant_id,
        service_type: serviceForm.service_type || null,
        due_date: serviceForm.due_date || null,
        service_description: serviceForm.service_description || null,
        work_to_be_done: serviceForm.work_to_be_done || null,
        assigned_artisan: serviceForm.assigned_artisan || null,
        parts_required: serviceForm.parts_required || null,
        priority: serviceForm.priority,
        notes: serviceForm.notes || null,
      })
      setServiceFormSuccess(`Job card ${card.job_card_number} created.`)
      setShowServiceForm(false)
      setServiceForm({ service_type: '', due_date: '', service_description: '', work_to_be_done: '', assigned_artisan: '', parts_required: '', priority: 'medium', notes: '' })
      // Refresh active card so button switches to Mark Complete
      await loadEquipmentActiveCard(detailsModal.id)
    } catch (e: any) {
      setDetailsModalError(e?.response?.data?.detail || 'Failed to create job card')
    } finally {
      setServiceFormSaving(false)
    }
  }

  async function handleCompleteFromModal() {
    if (!equipmentActiveCard || !detailsModal?.id) return
    if (!completeForm.service_date) { setDetailsModalError('Service date is required'); return }
    setCompleting(true)
    setDetailsModalError('')
    try {
      await completeJobCard(equipmentActiveCard.id, {
        service_date: completeForm.service_date,
        performed_by: completeForm.performed_by || null,
        work_done: completeForm.work_done || null,
        parts_used: completeForm.parts_used || null,
        completion_notes: completeForm.completion_notes || null,
      })
      setShowServiceForm(false)
      setCompleteForm({ service_date: '', performed_by: '', work_done: '', parts_used: '', completion_notes: '' })
      setServiceFormSuccess('Service completed and history recorded.')
      // Refresh equipment details (updated service dates) + clear active card
      const [updated] = await Promise.all([
        getEquipmentDetails(detailsModal.id),
        loadEquipmentActiveCard(detailsModal.id),
      ])
      setDetailsModal(updated)
      loadEquipment()
    } catch (e: any) {
      setDetailsModalError(e?.response?.data?.detail || 'Failed to complete job card')
    } finally {
      setCompleting(false)
    }
  }

  async function handleDeleteEquip(id: number) {
    if (!confirm('Delete this equipment?')) return
    try {
      await deleteEquipment(id)
      loadEquipment()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete equipment')
    }
  }

  function serviceStatusBadge(status?: string | null) {
    if (status === 'Overdue') return 'bg-red-100 text-red-800'
    if (status === 'Due Soon') return 'bg-yellow-100 text-yellow-800'
    if (status === 'On Schedule') return 'bg-green-100 text-green-800'
    return 'bg-gray-100 text-gray-600'
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {error && (
        <div className="col-span-full rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Plants panel */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Plants ({plants.length})
          </h2>
          <button
            className="btn-secondary btn-sm"
            onClick={() => setAddingPlant(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {addingPlant && (
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              className="input text-sm flex-1"
              placeholder="Plant name"
              value={newPlantName}
              onChange={(e) => setNewPlantName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePlant()}
            />
            <button onClick={handleCreatePlant} className="btn-primary btn-sm p-2"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setAddingPlant(false)} className="btn-secondary btn-sm p-2"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        <ul className="space-y-1">
          {plants.map((p) => (
            <li
              key={p.id}
              className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                selectedPlant === p.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
              }`}
              onClick={() => {
                setSelectedPlant(selectedPlant === p.id ? null : p.id)
                setSelectedGroup(null)
              }}
            >
              {editingPlant === p.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    className="input text-sm flex-1 py-1"
                    value={plantName}
                    onChange={(e) => setPlantName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdatePlant(p.id)}
                  />
                  <button onClick={(e) => { e.stopPropagation(); handleUpdatePlant(p.id) }} className="text-green-600"><Check className="h-3.5 w-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingPlant(null) }} className="text-gray-400"><X className="h-3.5 w-3.5" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{p.name}</span>
                  <span className="text-xs text-gray-400">
                    {allEquipment.filter((e) => e.plant_id === p.id).length}
                  </span>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingPlant(p.id); setPlantName(p.name) }}
                      className="text-gray-400 hover:text-blue-600"
                    ><Pencil className="h-3 w-3" /></button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePlant(p.id) }}
                      className="text-gray-400 hover:text-red-600"
                    ><Trash2 className="h-3 w-3" /></button>
                  </div>
                </>
              )}
            </li>
          ))}
          {plants.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No plants yet</p>
          )}
        </ul>
      </div>

      {/* Equipment groups panel */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Equipment Groups ({selectedPlant ? groups.filter((g) => g.plant_id === selectedPlant).length : 0})
          </h2>
          <button
            className="btn-secondary btn-sm"
            onClick={() => {
              setNewGroupName('')
              setNewGroupPlantId(selectedPlant)
              setAddingGroup(true)
            }}
            disabled={!selectedPlant}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {addingGroup && (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              type="text"
              className="input text-sm"
              placeholder="Group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            />
            <select
              className="input text-sm"
              value={newGroupPlantId ?? ''}
              onChange={(e) => setNewGroupPlantId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Unassigned plant</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={handleCreateGroup} className="btn-primary btn-sm">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setAddingGroup(false)} className="btn-secondary btn-sm">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <ul className="space-y-1">
          {selectedPlant ? groups
            .filter((g) => g.plant_id === selectedPlant)
            .map((g) => (
              <li
                key={g.id}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  selectedGroup === g.id ? 'bg-green-50 text-green-700' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedGroup(selectedGroup === g.id ? null : g.id)}
              >
                {editingGroup === g.id ? (
                  <>
                    <input
                      autoFocus
                      type="text"
                      className="input text-sm flex-1 py-1"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateGroup(g.id)}
                    />
                    <select
                      className="input text-sm w-40"
                      value={groupPlantId ?? ''}
                      onChange={(e) => setGroupPlantId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Unassigned plant</option>
                      {plants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button onClick={(e) => { e.stopPropagation(); handleUpdateGroup(g.id) }} className="text-green-600"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingGroup(null) }} className="text-gray-400"><X className="h-3.5 w-3.5" /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{g.name}</span>
                    <span className="text-xs text-gray-400">
                      {g.plant_name || 'Unassigned'}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingGroup(g.id); setGroupName(g.name); setGroupPlantId(g.plant_id) }}
                        className="text-gray-400 hover:text-blue-600"
                      ><Pencil className="h-3 w-3" /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id) }}
                        className="text-gray-400 hover:text-red-600"
                      ><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </>
                )}
              </li>
            )) : (
              <p className="text-xs text-gray-400 text-center py-4">Select a plant to view equipment groups</p>
            )}
          {selectedPlant && groups.filter((g) => g.plant_id === selectedPlant).length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No equipment groups for this plant</p>
          )}
        </ul>
      </div>

      </div>

      {/* Equipment table */}
      <div className="col-span-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">
            Equipment
            {selectedPlant && (
              <span className="ml-2 text-sm text-blue-600 font-normal">
                — {plants.find((p) => p.id === selectedPlant)?.name}
              </span>
            )}
            <span className="ml-2 text-sm text-gray-400">({visibleEquipment.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <select
              className="input text-sm py-1.5 w-44"
              value={selectedPlant ?? ''}
              onChange={(e) => {
                setSelectedPlant(e.target.value ? Number(e.target.value) : null)
                setSelectedGroup(null)
              }}
            >
              <option value="">All plants</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className="input text-sm py-1.5 w-44"
              value={selectedGroup ?? ''}
              onChange={(e) => setSelectedGroup(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">
                {selectedPlant ? 'All groups' : 'No plant selected'}
              </option>
              {selectedPlant ? groups
                .filter((g) => g.plant_id === selectedPlant)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                )) : null}
            </select>
            <button
              className="btn-primary btn-sm"
              onClick={() => {
                setNewEquipForm((f) => ({ ...f, plant_id: selectedPlant, equipment_group_id: selectedGroup }))
                setAddingEquip(true)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Equipment
            </button>
          </div>
        </div>

        {addingEquip && (
          <div className="card grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="label">Name *</label>
              <input type="text" className="input" placeholder="Equipment name" value={newEquipForm.name} onChange={(e) => setNewEquipForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="label">Code</label>
              <input type="text" className="input" placeholder="Code" value={newEquipForm.code} onChange={(e) => setNewEquipForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="label">Manufacturer</label>
              <input type="text" className="input" placeholder="Manufacturer" value={newEquipForm.manufacturer} onChange={(e) => setNewEquipForm((f) => ({ ...f, manufacturer: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="label">Model Number</label>
              <input type="text" className="input" placeholder="Model number" value={newEquipForm.model_number} onChange={(e) => setNewEquipForm((f) => ({ ...f, model_number: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="label">Service Type</label>
              <input type="text" className="input" placeholder="Service type" value={newEquipForm.service_type} onChange={(e) => setNewEquipForm((f) => ({ ...f, service_type: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="label">Last Service</label>
              <input type="date" className="input" value={newEquipForm.last_service_date} onChange={(e) => setNewEquipForm((f) => ({ ...f, last_service_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="label">Interval (days)</label>
              <input
                type="number"
                min={1}
                className="input"
                value={newEquipForm.service_interval_days ?? ''}
                onChange={(e) => setNewEquipForm((f) => ({ ...f, service_interval_days: e.target.value ? Number(e.target.value) : null }))}
              />
            </div>
            <div className="space-y-2">
              <label className="label">Service Notes</label>
              <input
                type="text"
                className="input"
                placeholder="Notes"
                value={newEquipForm.service_notes}
                onChange={(e) => setNewEquipForm((f) => ({ ...f, service_notes: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="label">Plant</label>
              <select
                className="input"
                value={newEquipForm.plant_id ?? ''}
                onChange={(e) =>
                  setNewEquipForm((f) => ({
                    ...f,
                    plant_id: e.target.value ? Number(e.target.value) : null,
                    equipment_group_id: null,
                  }))
                }
              >
                <option value="">Unassigned</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="label">Group</label>
              <select
                className="input"
                value={newEquipForm.equipment_group_id ?? ''}
                disabled={!newEquipForm.plant_id}
                onChange={(e) =>
                  setNewEquipForm((f) => ({
                    ...f,
                    equipment_group_id: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              >
                <option value="">No group</option>
                {newEquipForm.plant_id
                  ? groups
                      .filter((g) => g.plant_id === newEquipForm.plant_id)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))
                  : null}
              </select>
            </div>
            <div className="space-y-2">
              <label className="label">Status</label>
              <select className="input" value={newEquipForm.status} onChange={(e) => setNewEquipForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="label">Next Service</label>
              <div className="text-sm text-gray-700 py-2">{calculateNextServiceDate(newEquipForm.last_service_date, newEquipForm.service_interval_days) || '—'}</div>
            </div>
            <div className="space-y-2">
              <label className="label">Service Status</label>
              <div className="text-sm text-gray-700 py-2">{calculateServiceStatus(newEquipForm.last_service_date, newEquipForm.service_interval_days)}</div>
            </div>
            <div className="lg:col-span-3 space-y-2">
              <label className="label">Description</label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Equipment description"
                value={newEquipForm.description}
                onChange={(e) => setNewEquipForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={handleCreateEquip} className="btn-primary">Save</button>
              <button onClick={() => setAddingEquip(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Equipment Name</th>
                <th>Code</th>
                <th>Manufacturer</th>
                <th>Model No.</th>
                <th>Plant</th>
                <th>Group</th>
                <th>Status</th>
                <th>Last Service</th>
                <th>Interval</th>
                <th>Next Service</th>
                <th>Service Status</th>
                <th>Type</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {visibleEquipment.map((eq) => (
                <tr key={eq.id} className="cursor-pointer" onClick={() => openDetailsModal(eq.id)}>
                  <td className="font-medium">{eq.equipment_name}</td>
                  <td className="font-mono text-xs text-gray-500">{eq.equipment_code || '—'}</td>
                  <td className="text-sm text-gray-600">{eq.manufacturer || '—'}</td>
                  <td className="text-sm text-gray-600">{eq.model_number || '—'}</td>
                  <td className="text-gray-500">{eq.plant_name || '—'}</td>
                  <td className="text-gray-500">{eq.equipment_group_name || '—'}</td>
                  <td>
                    <span className={`badge ${eq.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {eq.status}
                    </span>
                  </td>
                  <td className="text-sm text-gray-600">{eq.last_service_date || '—'}</td>
                  <td className="text-sm text-gray-600">{eq.service_interval_days ?? '—'}</td>
                  <td className="text-sm text-gray-600">{eq.next_service_date || '—'}</td>
                  <td>
                    <span className={`badge ${serviceStatusBadge(eq.service_status)}`}>
                      {eq.service_status || 'Not Scheduled'}
                    </span>
                  </td>
                  <td className="text-sm text-gray-600">{eq.service_type || '—'}</td>
                  <td className="text-sm text-gray-600 max-w-[160px] truncate">{eq.service_notes || '—'}</td>
                </tr>
              ))}
              {visibleEquipment.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center text-gray-400 py-8">
                    No equipment found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Equipment Pagination */}
        {totalEquipment > EQUIPMENT_PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Showing {equipmentPage * EQUIPMENT_PAGE_SIZE + 1}-{Math.min((equipmentPage + 1) * EQUIPMENT_PAGE_SIZE, totalEquipment)} of {totalEquipment} equipment
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary btn-sm"
                onClick={() => setEquipmentPage(p => Math.max(0, p - 1))}
                disabled={equipmentPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {equipmentPage + 1} of {Math.ceil(totalEquipment / EQUIPMENT_PAGE_SIZE)}
              </span>
              <button
                className="btn-secondary btn-sm"
                onClick={() => setEquipmentPage(p => Math.min(Math.ceil(totalEquipment / EQUIPMENT_PAGE_SIZE) - 1, p + 1))}
                disabled={equipmentPage >= Math.ceil(totalEquipment / EQUIPMENT_PAGE_SIZE) - 1}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Equipment Details Modal ─────────────────────────────────────────── */}
      {(detailsModalLoading || detailsModal !== null) && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => { setDetailsModal(null); setModalEditing(false); setDetailsModalError('') }}
        >
          <div
            className="card w-full max-w-4xl my-8 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {detailsModalLoading ? (
              <div className="flex h-40 items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : detailsModal && detailsModal.id ? (
              <>
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">{detailsModal.equipment_name}</h2>
                    {detailsModal.equipment_code && (
                      <p className="text-sm font-mono text-gray-500 mt-0.5">{detailsModal.equipment_code}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!modalEditing && (
                      <>
                        {equipmentActiveCard ? (
                          <button
                            title={`Mark complete — ${equipmentActiveCard.job_card_number}`}
                            onClick={() => { setShowServiceForm(true); setServiceFormSuccess('') }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Mark Complete
                          </button>
                        ) : (
                          <button
                            title="Create service job card"
                            onClick={() => {
                              setServiceFormSuccess('')
                              setServiceForm((f) => ({ ...f, due_date: detailsModal.next_service_date || '', service_type: detailsModal.service_type || '' }))
                              setShowServiceForm((v) => !v)
                            }}
                            className={`p-1.5 rounded transition-colors ${showServiceForm ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                          >
                            <Zap className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          title="Edit equipment"
                          onClick={() => {
                            setDetailsModalError('')
                            setShowServiceForm(false)
                            setServiceFormSuccess('')
                            setEquipForm({
                              name: detailsModal.equipment_name,
                              code: detailsModal.equipment_code || '',
                              status: detailsModal.status,
                              plant_id: detailsModal.plant_id,
                              equipment_group_id: detailsModal.equipment_group_id,
                              last_service_date: detailsModal.last_service_date || '',
                              service_interval_days: detailsModal.service_interval_days ?? null,
                              service_type: detailsModal.service_type || '',
                              service_notes: detailsModal.service_notes || '',
                              manufacturer: detailsModal.manufacturer || '',
                              model_number: detailsModal.model_number || '',
                              description: detailsModal.description || '',
                            })
                            setModalEditing(true)
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title="Delete equipment"
                          onClick={() => {
                            setDetailsModal(null)
                            setModalEditing(false)
                            setDetailsModalError('')
                            handleDeleteEquip(detailsModal.id)
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { setDetailsModal(null); setModalEditing(false); setDetailsModalError('') }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors ml-1"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {detailsModalError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{detailsModalError}</div>
                )}

                {serviceFormSuccess && (
                  <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center justify-between">
                    {serviceFormSuccess}
                    <button onClick={() => setServiceFormSuccess('')}><X className="h-4 w-4" /></button>
                  </div>
                )}

                {/* ── Edit form ── */}
                {modalEditing ? (
                  <div className="border-t pt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-1">
                        <label className="label">Name *</label>
                        <input type="text" className="input" value={equipForm.name} onChange={(e) => setEquipForm((f) => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="label">Code</label>
                        <input type="text" className="input" value={equipForm.code} onChange={(e) => setEquipForm((f) => ({ ...f, code: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="label">Status</label>
                        <select className="input" value={equipForm.status} onChange={(e) => setEquipForm((f) => ({ ...f, status: e.target.value }))}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="label">Manufacturer</label>
                        <input type="text" className="input" value={equipForm.manufacturer} onChange={(e) => setEquipForm((f) => ({ ...f, manufacturer: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="label">Model Number</label>
                        <input type="text" className="input" value={equipForm.model_number} onChange={(e) => setEquipForm((f) => ({ ...f, model_number: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="label">Plant</label>
                        <select
                          className="input"
                          value={equipForm.plant_id ?? ''}
                          onChange={(e) => setEquipForm((f) => ({ ...f, plant_id: e.target.value ? Number(e.target.value) : null, equipment_group_id: null }))}
                        >
                          <option value="">Unassigned</option>
                          {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="label">Group</label>
                        <select
                          className="input"
                          value={equipForm.equipment_group_id ?? ''}
                          disabled={!equipForm.plant_id}
                          onChange={(e) => setEquipForm((f) => ({ ...f, equipment_group_id: e.target.value ? Number(e.target.value) : null }))}
                        >
                          <option value="">No group</option>
                          {equipForm.plant_id ? groups.filter((g) => g.plant_id === equipForm.plant_id).map((g) => <option key={g.id} value={g.id}>{g.name}</option>) : null}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="label">Last Service</label>
                        <input type="date" className="input" value={equipForm.last_service_date} onChange={(e) => setEquipForm((f) => ({ ...f, last_service_date: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="label">Interval (days)</label>
                        <input
                          type="number" min={1} className="input"
                          value={equipForm.service_interval_days ?? ''}
                          onChange={(e) => setEquipForm((f) => ({ ...f, service_interval_days: e.target.value ? Number(e.target.value) : null }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="label">Next Service</label>
                        <div className="text-sm text-gray-700 py-2">{calculateNextServiceDate(equipForm.last_service_date, equipForm.service_interval_days) || '—'}</div>
                      </div>
                      <div className="space-y-1">
                        <label className="label">Service Status</label>
                        <div className="text-sm text-gray-700 py-2">{calculateServiceStatus(equipForm.last_service_date, equipForm.service_interval_days)}</div>
                      </div>
                      <div className="space-y-1">
                        <label className="label">Service Type</label>
                        <input type="text" className="input" value={equipForm.service_type} onChange={(e) => setEquipForm((f) => ({ ...f, service_type: e.target.value }))} />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3 space-y-1">
                        <label className="label">Service Notes</label>
                        <input type="text" className="input" value={equipForm.service_notes} onChange={(e) => setEquipForm((f) => ({ ...f, service_notes: e.target.value }))} />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3 space-y-1">
                        <label className="label">Description</label>
                        <textarea className="input resize-none" rows={3} value={equipForm.description} onChange={(e) => setEquipForm((f) => ({ ...f, description: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => handleUpdateEquip(detailsModal.id)} className="btn-primary">Save changes</button>
                      <button onClick={() => { setModalEditing(false); setDetailsModalError('') }} className="btn-secondary">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                {/* Equipment Info Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 border-t pt-4">
                  <InfoField label="Plant" value={detailsModal.plant_name} />
                  <InfoField label="Group" value={detailsModal.equipment_group_name} />
                  <InfoField label="Status">
                    <span className={`badge ${detailsModal.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {detailsModal.status}
                    </span>
                  </InfoField>
                  <InfoField label="Manufacturer" value={detailsModal.manufacturer} />
                  <InfoField label="Model Number" value={detailsModal.model_number} />
                  <InfoField label="Last Service" value={detailsModal.last_service_date} />
                  <InfoField label="Next Service" value={detailsModal.next_service_date} />
                  <InfoField label="Service Status">
                    <span className={`badge ${serviceStatusBadge(detailsModal.service_status)}`}>
                      {detailsModal.service_status || 'Not Scheduled'}
                    </span>
                  </InfoField>
                  <InfoField label="Service Type" value={detailsModal.service_type} />
                  <InfoField label="Interval" value={detailsModal.service_interval_days != null ? `${detailsModal.service_interval_days} days` : null} />
                </div>

                {/* Description */}
                {detailsModal.description && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{detailsModal.description}</p>
                  </div>
                )}
                {detailsModal.service_notes && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Service Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{detailsModal.service_notes}</p>
                  </div>
                )}

                {/* Service Job Card form — create or complete depending on active card */}
                {showServiceForm && (
                  equipmentActiveCard ? (
                    /* ── Complete form ── */
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        Complete Service — <span className="font-mono">{equipmentActiveCard.job_card_number}</span>
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="label">Service Date *</label>
                          <input type="date" className="input" value={completeForm.service_date} onChange={(e) => setCompleteForm((f) => ({ ...f, service_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Performed By</label>
                          <input type="text" className="input" value={completeForm.performed_by} onChange={(e) => setCompleteForm((f) => ({ ...f, performed_by: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Work Done</label>
                          <textarea className="input resize-none" rows={2} value={completeForm.work_done} onChange={(e) => setCompleteForm((f) => ({ ...f, work_done: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Parts Used</label>
                          <textarea className="input resize-none" rows={2} value={completeForm.parts_used} onChange={(e) => setCompleteForm((f) => ({ ...f, parts_used: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Completion Notes</label>
                          <textarea className="input resize-none" rows={2} value={completeForm.completion_notes} onChange={(e) => setCompleteForm((f) => ({ ...f, completion_notes: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleCompleteFromModal} disabled={completing} className="btn-primary flex items-center gap-1.5">
                          {completing ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                          Confirm Complete
                        </button>
                        <button onClick={() => setShowServiceForm(false)} className="btn-secondary">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* ── Create form ── */
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-green-600" />
                        Create Service Job Card
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="label">Service Type</label>
                          <input type="text" className="input" value={serviceForm.service_type} onChange={(e) => setServiceForm((f) => ({ ...f, service_type: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Due Date</label>
                          <input
                            type="date"
                            className="input"
                            value={serviceForm.due_date}
                            placeholder={detailsModal.next_service_date || ''}
                            onChange={(e) => setServiceForm((f) => ({ ...f, due_date: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Assigned Artisan</label>
                          <input type="text" className="input" value={serviceForm.assigned_artisan} onChange={(e) => setServiceForm((f) => ({ ...f, assigned_artisan: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Priority</label>
                          <select className="input" value={serviceForm.priority} onChange={(e) => setServiceForm((f) => ({ ...f, priority: e.target.value }))}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Service Description</label>
                          <textarea className="input resize-none" rows={2} value={serviceForm.service_description} onChange={(e) => setServiceForm((f) => ({ ...f, service_description: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Work To Be Done</label>
                          <textarea className="input resize-none" rows={2} value={serviceForm.work_to_be_done} onChange={(e) => setServiceForm((f) => ({ ...f, work_to_be_done: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Parts Required</label>
                          <textarea className="input resize-none" rows={2} value={serviceForm.parts_required} onChange={(e) => setServiceForm((f) => ({ ...f, parts_required: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Notes</label>
                          <textarea className="input resize-none" rows={2} value={serviceForm.notes} onChange={(e) => setServiceForm((f) => ({ ...f, notes: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleCreateJobCard} disabled={serviceFormSaving} className="btn-primary flex items-center gap-1.5">
                          {serviceFormSaving ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                          Save Job Card
                        </button>
                        <button onClick={() => setShowServiceForm(false)} className="btn-secondary">Cancel</button>
                      </div>
                    </div>
                  )
                )}

                {/* Recent Service History */}
                <div className="border-t pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Recent Service History</h3>
                  {detailsModal.recent_service_histories.length === 0 ? (
                    <p className="text-xs text-gray-400">No service history recorded.</p>
                  ) : (
                    <div className="table-container">
                      <table className="table text-sm">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Performed By</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailsModal.recent_service_histories.map((s) => (
                            <tr key={s.id}>
                              <td className="text-gray-600">{s.service_date}</td>
                              <td>{s.service_type || '—'}</td>
                              <td className="text-gray-600">{s.performed_by || '—'}</td>
                              <td className="text-gray-500 max-w-[200px] truncate">{s.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Recent Maintenance Records */}
                <div className="border-t pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Recent Maintenance Records</h3>
                  {detailsModal.recent_maintenance_records.length === 0 ? (
                    <p className="text-xs text-gray-400">No maintenance records found.</p>
                  ) : (
                    <div className="table-container">
                      <table className="table text-sm">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>MR No.</th>
                            <th>Issue</th>
                            <th>Artisan</th>
                            <th>Downtime</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailsModal.recent_maintenance_records.map((r) => (
                            <tr key={r.id}>
                              <td className="text-gray-600">{r.record_date}</td>
                              <td className="font-mono text-xs text-gray-500">{r.mr_no || '—'}</td>
                              <td className="max-w-[200px] truncate">{r.issue_description || '—'}</td>
                              <td className="text-gray-600">{r.artisan_name || '—'}</td>
                              <td className="text-gray-600">{r.downtime_minutes > 0 ? `${r.downtime_minutes} min` : '—'}</td>
                              <td>
                                <span className={`badge ${
                                  r.status === 'closed' ? 'bg-green-100 text-green-800'
                                  : r.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                                }`}>
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                  </>
                )}
              </>
            ) : (
              detailsModalError ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-700">Equipment Details</h2>
                    <button onClick={() => { setDetailsModal(null); setModalEditing(false); setDetailsModalError('') }} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{detailsModalError}</div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoField({
  label,
  value,
  children,
}: {
  label: string
  value?: string | number | null
  children?: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {children ? (
        <div className="mt-1">{children}</div>
      ) : (
        <p className="mt-1 text-sm text-gray-800">{value ?? '—'}</p>
      )}
    </div>
  )
}
