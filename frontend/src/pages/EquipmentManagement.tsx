import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Check, X, Building2, ChevronLeft, ChevronRight, Zap, Cpu } from 'lucide-react'
import {
  completeJobCard,
  createComponent,
  createEquipment,
  createEquipmentGroup,
  createJobCard,
  createPlant,
  deleteComponent,
  deleteEquipment,
  deleteEquipmentGroup,
  deletePlant,
  getComponents,
  getEquipment,
  getEquipmentDetails,
  getEquipmentGroups,
  getJobCards,
  getPlants,
  updateComponent,
  updateEquipment,
  updateEquipmentGroup,
  updatePlant,
} from '../services/api'
import type {
  Equipment,
  EquipmentComponent,
  EquipmentDetails,
  EquipmentGroup,
  Plant,
  ServiceJobCard,
} from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import ListInput, { parseListField, serializeListField } from '../components/ListInput'
import ConfirmDialog from '../components/ConfirmDialog'

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
  const location = useLocation()
  const navigate = useNavigate()
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

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })

  function askConfirm(title: string, message: string, onConfirm: () => void) {
    setConfirmDialog({ open: true, title, message, onConfirm })
  }
  function closeConfirm() { setConfirmDialog(s => ({ ...s, open: false })) }

  // Equipment Details modal state
  const [modalEditing, setModalEditing] = useState(false)

  const [detailsModal, setDetailsModal] = useState<EquipmentDetails | null>(null)
  const [detailsModalLoading, setDetailsModalLoading] = useState(false)
  const [detailsModalError, setDetailsModalError] = useState('')

  // Service job card form (inside details modal)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [serviceForm, setServiceForm] = useState({
    service_type: '',
    start_date: '',
    due_date: '',
    service_description: '',
    work_to_be_done: [] as string[],
    assigned_artisan: '',
    assigned_by: '',
    parts_required: [] as string[],
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
    work_done: [] as string[],
    parts_used: [] as string[],
    completion_notes: '',
  })
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (!detailsModal) {
      setShowServiceForm(false)
      setServiceFormSuccess('')
      setEquipmentActiveCard(null)
      setCompleteForm({ service_date: '', performed_by: '', work_done: [], parts_used: [], completion_notes: '' })
    }
  }, [detailsModal])

  useEffect(() => {
    Promise.all([getPlants(), getEquipmentGroups()])
      .then(([p, g]) => {
        setPlants(p)
        setGroups(g)
      })
      .finally(() => {
        setLoading(false)
        const id = (location.state as any)?.openEquipmentId
        if (id) openDetailsModal(id)
      })
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

  function handleDeletePlant(id: number) {
    askConfirm('Delete Plant', 'Equipment assigned to this plant will be unassigned. This cannot be undone.', async () => {
      closeConfirm()
      try {
        await deletePlant(id)
        setPlants((prev) => prev.filter((p) => p.id !== id))
        if (selectedPlant === id) setSelectedPlant(null)
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Failed to delete plant')
      }
    })
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

  function handleDeleteGroup(id: number) {
    askConfirm('Delete Equipment Group', 'Equipment assigned to this group will be ungrouped. This cannot be undone.', async () => {
      closeConfirm()
      try {
        await deleteEquipmentGroup(id)
        setGroups((prev) => prev.filter((g) => g.id !== id))
        if (selectedGroup === id) setSelectedGroup(null)
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Failed to delete group')
      }
    })
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
        work_to_be_done: serializeListField(serviceForm.work_to_be_done),
        assigned_artisan: serviceForm.assigned_artisan || null,
        assigned_by: serviceForm.assigned_by || null,
        start_date: serviceForm.start_date || null,
        parts_required: serializeListField(serviceForm.parts_required),
        priority: serviceForm.priority,
        notes: serviceForm.notes || null,
      })
      setServiceFormSuccess(`Job card ${card.job_card_number} created.`)
      setShowServiceForm(false)
      setServiceForm({ service_type: '', start_date: '', due_date: '', service_description: '', work_to_be_done: [], assigned_artisan: '', assigned_by: '', parts_required: [], priority: 'medium', notes: '' })
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
        work_done: serializeListField(completeForm.work_done),
        parts_used: serializeListField(completeForm.parts_used),
        completion_notes: completeForm.completion_notes || null,
      })
      setShowServiceForm(false)
      setCompleteForm({ service_date: '', performed_by: '', work_done: [], parts_used: [], completion_notes: '' })
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

  function handleDeleteEquip(id: number) {
    askConfirm('Delete Equipment', 'This equipment and its service history will be permanently deleted.', async () => {
      closeConfirm()
      try {
        await deleteEquipment(id)
        setDetailsModal(null)
        setModalEditing(false)
        loadEquipment()
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Failed to delete equipment')
      }
    })
  }

  function serviceStatusBadge(status?: string | null) {
    if (status === 'Overdue')    return 'bg-red-100 text-red-800'
    if (status === 'Due Today')  return 'bg-orange-100 text-orange-800'
    if (status === 'Due Soon')   return 'bg-yellow-100 text-yellow-800'
    if (status === 'On Schedule') return 'bg-green-100 text-green-800'
    return 'bg-gray-100 text-gray-600'
  }

  // ── Page-level tab ──────────────────────────────────────────────────────────
  const [pageTab, setPageTab] = useState<'equipment' | 'components'>('equipment')

  // ── Components tab state ─────────────────────────────────────────────────
  const COMPONENT_PAGE_SIZE = 50
  const [components, setComponents] = useState<EquipmentComponent[]>([])
  const [totalComponents, setTotalComponents] = useState(0)
  const [componentPage, setComponentPage] = useState(0)
  const [componentLoading, setComponentLoading] = useState(false)
  const [componentError, setComponentError] = useState('')
  const [componentSearch, setComponentSearch] = useState('')
  const [componentFilterEquip, setComponentFilterEquip] = useState<number | null>(null)
  const [componentFilterPlant, setComponentFilterPlant] = useState<number | null>(null)
  const [componentFilterGroup, setComponentFilterGroup] = useState<number | null>(null)
  const [componentFilterStatus, setComponentFilterStatus] = useState('')

  const EMPTY_COMP_FORM = {
    equipment_id: null as number | null,
    component_name: '',
    manufacturer: '',
    model_number: '',
    description: '',
    last_service_date: '',
    service_interval_days: null as number | null,
    notes: '',
    status: 'active',
  }
  const [addingComponent, setAddingComponent] = useState(false)
  const [newCompForm, setNewCompForm] = useState({ ...EMPTY_COMP_FORM })
  const [newCompFormPlant, setNewCompFormPlant] = useState<number | null>(null)
  const [newCompFormGroup, setNewCompFormGroup] = useState<number | null>(null)
  const [editCompForm, setEditCompForm] = useState({ ...EMPTY_COMP_FORM })
  const [compFormSaving, setCompFormSaving] = useState(false)

  const [componentDetailModal, setComponentDetailModal] = useState<EquipmentComponent | null>(null)
  const [componentModalEditing, setComponentModalEditing] = useState(false)
  const [componentModalHistory, setComponentModalHistory] = useState<ServiceJobCard[]>([])
  const [componentModalHistoryLoading, setComponentModalHistoryLoading] = useState(false)
  const [componentActiveCard, setComponentActiveCard] = useState<ServiceJobCard | null>(null)
  const [showCompServiceForm, setShowCompServiceForm] = useState(false)
  const [compServiceForm, setCompServiceForm] = useState({
    service_type: '', start_date: '', due_date: '', service_description: '',
    work_to_be_done: [] as string[], assigned_artisan: '', assigned_by: '',
    parts_required: [] as string[], priority: 'medium', notes: '',
  })
  const [compCompleteForm, setCompCompleteForm] = useState({
    service_date: '', performed_by: '', work_done: [] as string[],
    parts_used: [] as string[], completion_notes: '',
  })
  const [compServiceFormSaving, setCompServiceFormSaving] = useState(false)
  const [compCompleting, setCompCompleting] = useState(false)
  const [compServiceFormSuccess, setCompServiceFormSuccess] = useState('')
  const [compServiceFormError, setCompServiceFormError] = useState('')

  useEffect(() => {
    if (!componentDetailModal) {
      setComponentModalHistory([])
      setComponentActiveCard(null)
      setShowCompServiceForm(false)
      setCompServiceFormSuccess('')
      setCompServiceFormError('')
      return
    }
    // Always reset form state when component changes (handles direct row-to-row switching)
    setShowCompServiceForm(false)
    setCompServiceFormSuccess('')
    setCompServiceFormError('')
    setComponentActiveCard(null)
    setComponentModalHistoryLoading(true)
    getJobCards({ component_id: componentDetailModal.id, status: 'completed', limit: 50 })
      .then((res) => setComponentModalHistory(res.job_cards))
      .catch(() => setComponentModalHistory([]))
      .finally(() => setComponentModalHistoryLoading(false))
    getJobCards({ component_id: componentDetailModal.id, limit: 20 })
      .then((res) => setComponentActiveCard(res.job_cards.find((c) => c.status !== 'completed') ?? null))
      .catch(() => setComponentActiveCard(null))
  }, [componentDetailModal?.id])

  // Components inside the details modal
  const [modalComponents, setModalComponents] = useState<EquipmentComponent[]>([])
  const [modalCompLoading, setModalCompLoading] = useState(false)
  const [addingModalComp, setAddingModalComp] = useState(false)
  const [modalCompForm, setModalCompForm] = useState({ ...EMPTY_COMP_FORM })
  const [editingModalComp, setEditingModalComp] = useState<EquipmentComponent | null>(null)
  const [editModalCompForm, setEditModalCompForm] = useState({ ...EMPTY_COMP_FORM })
  const [modalCompSaving, setModalCompSaving] = useState(false)

  async function loadComponents() {
    setComponentLoading(true)
    setComponentError('')
    try {
      const res = await getComponents({
        equipment_id: componentFilterEquip || undefined,
        plant_id: componentFilterPlant || undefined,
        service_status: componentFilterStatus || undefined,
        search: componentSearch || undefined,
        skip: componentPage * COMPONENT_PAGE_SIZE,
        limit: COMPONENT_PAGE_SIZE,
      })
      setComponents(res.components)
      setTotalComponents(res.total)
    } catch {
      setComponentError('Failed to load components')
    } finally {
      setComponentLoading(false)
    }
  }

  useEffect(() => {
    if (pageTab === 'components') loadComponents()
  }, [pageTab, componentPage, componentFilterEquip, componentFilterPlant, componentFilterStatus, componentSearch])

  async function loadModalComponents(equipmentId: number) {
    setModalCompLoading(true)
    try {
      const res = await getComponents({ equipment_id: equipmentId, limit: 200 })
      setModalComponents(res.components)
    } catch {
      setModalComponents([])
    } finally {
      setModalCompLoading(false)
    }
  }

  useEffect(() => {
    if (detailsModal?.id) {
      loadModalComponents(detailsModal.id)
    } else {
      setModalComponents([])
      setAddingModalComp(false)
      setEditingModalComp(null)
    }
  }, [detailsModal?.id])

  async function handleCreateComponent(form: typeof EMPTY_COMP_FORM, onDone: () => void) {
    if (!form.equipment_id || !form.component_name.trim()) return
    setCompFormSaving(true)
    try {
      await createComponent({
        equipment_id: form.equipment_id,
        component_name: form.component_name.trim(),
        manufacturer: form.manufacturer || null,
        model_number: form.model_number || null,
        description: form.description || null,
        last_service_date: form.last_service_date || null,
        service_interval_days: form.service_interval_days,
        notes: form.notes || null,
        status: form.status,
      })
      onDone()
    } catch (e: any) {
      setComponentError(e?.response?.data?.detail || 'Failed to create component')
    } finally {
      setCompFormSaving(false)
    }
  }

  async function handleUpdateComponent(id: number, form: typeof EMPTY_COMP_FORM, onDone: () => void) {
    setCompFormSaving(true)
    try {
      await updateComponent(id, {
        component_name: form.component_name.trim(),
        manufacturer: form.manufacturer || null,
        model_number: form.model_number || null,
        description: form.description || null,
        last_service_date: form.last_service_date || null,
        service_interval_days: form.service_interval_days,
        notes: form.notes || null,
        status: form.status,
      })
      onDone()
    } catch (e: any) {
      setComponentError(e?.response?.data?.detail || 'Failed to update component')
    } finally {
      setCompFormSaving(false)
    }
  }

  function handleDeleteComponent(id: number, onDone?: () => void) {
    askConfirm('Delete Component', 'This component will be permanently deleted.', async () => {
      closeConfirm()
      try {
        await deleteComponent(id)
        onDone?.()
      } catch (e: any) {
        setComponentError(e?.response?.data?.detail || 'Failed to delete component')
      }
    })
  }

  async function handleCreateCompJobCard() {
    if (!componentDetailModal) return
    setCompServiceFormSaving(true)
    setCompServiceFormError('')
    setCompServiceFormSuccess('')
    try {
      const card = await createJobCard({
        equipment_id: componentDetailModal.equipment_id,
        component_id: componentDetailModal.id,
        plant_id: componentDetailModal.plant_id,
        service_type: compServiceForm.service_type || null,
        due_date: compServiceForm.due_date || null,
        service_description: compServiceForm.service_description || null,
        work_to_be_done: serializeListField(compServiceForm.work_to_be_done),
        assigned_artisan: compServiceForm.assigned_artisan || null,
        assigned_by: compServiceForm.assigned_by || null,
        start_date: compServiceForm.start_date || null,
        parts_required: serializeListField(compServiceForm.parts_required),
        priority: compServiceForm.priority,
        notes: compServiceForm.notes || null,
      })
      setCompServiceFormSuccess(`Job card ${card.job_card_number} created.`)
      setShowCompServiceForm(false)
      setCompServiceForm({ service_type: '', start_date: '', due_date: '', service_description: '', work_to_be_done: [], assigned_artisan: '', assigned_by: '', parts_required: [], priority: 'medium', notes: '' })
      setComponentActiveCard(card)
    } catch (e: any) {
      setCompServiceFormError(e?.response?.data?.detail || 'Failed to create job card')
    } finally {
      setCompServiceFormSaving(false)
    }
  }

  async function handleCompleteCompJobCard() {
    if (!componentActiveCard || !componentDetailModal) return
    if (!compCompleteForm.service_date) { setCompServiceFormError('Service date is required'); return }
    setCompCompleting(true)
    setCompServiceFormError('')
    try {
      await completeJobCard(componentActiveCard.id, {
        service_date: compCompleteForm.service_date,
        performed_by: compCompleteForm.performed_by || null,
        work_done: serializeListField(compCompleteForm.work_done),
        parts_used: serializeListField(compCompleteForm.parts_used),
        completion_notes: compCompleteForm.completion_notes || null,
      })
      setShowCompServiceForm(false)
      setCompCompleteForm({ service_date: '', performed_by: '', work_done: [], parts_used: [], completion_notes: '' })
      setCompServiceFormSuccess('Service completed.')
      setComponentActiveCard(null)
      const newNextDate = calculateNextServiceDate(compCompleteForm.service_date, componentDetailModal.service_interval_days)
      const newStatus = calculateServiceStatus(compCompleteForm.service_date, componentDetailModal.service_interval_days)
      setComponentDetailModal((prev) => prev ? {
        ...prev,
        last_service_date: compCompleteForm.service_date,
        next_service_date: newNextDate || null,
        service_status: newStatus,
      } : prev)
      const histRes = await getJobCards({ component_id: componentDetailModal.id, status: 'completed', limit: 50 })
      setComponentModalHistory(histRes.job_cards)
      loadComponents()
    } catch (e: any) {
      setCompServiceFormError(e?.response?.data?.detail || 'Failed to complete service')
    } finally {
      setCompCompleting(false)
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
    <div className="grid grid-cols-1 gap-6">
      {/* Page tabs */}
      <div className="col-span-full flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setPageTab('equipment')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            pageTab === 'equipment'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Equipment
        </button>
        <button
          onClick={() => setPageTab('components')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            pageTab === 'components'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Cpu className="h-4 w-4" />
          Components
        </button>
      </div>

      {error && (
        <div className="col-span-full rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── Components Tab ──────────────────────────────────────────────────── */}
      {pageTab === 'components' && (
        <div className="col-span-full space-y-4">
          {componentError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
              {componentError}
              <button onClick={() => setComponentError('')}><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="input text-sm py-1.5 w-48"
              placeholder="Search name or equipment…"
              value={componentSearch}
              onChange={(e) => { setComponentSearch(e.target.value); setComponentPage(0) }}
            />
            <select
              className="input text-sm py-1.5 w-44"
              value={componentFilterPlant ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null
                setComponentFilterPlant(val)
                setComponentFilterGroup(null)
                setComponentFilterEquip(null)
                setComponentPage(0)
              }}
            >
              <option value="">All plants</option>
              {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              className="input text-sm py-1.5 w-44"
              value={componentFilterGroup ?? ''}
              disabled={!componentFilterPlant}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null
                setComponentFilterGroup(val)
                setComponentFilterEquip(null)
                setComponentPage(0)
              }}
            >
              <option value="">{componentFilterPlant ? 'All groups' : 'Select plant first'}</option>
              {componentFilterPlant
                ? groups.filter((g) => g.plant_id === componentFilterPlant).map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))
                : null}
            </select>
            <select
              className="input text-sm py-1.5 w-44"
              value={componentFilterEquip ?? ''}
              onChange={(e) => { setComponentFilterEquip(e.target.value ? Number(e.target.value) : null); setComponentPage(0) }}
            >
              <option value="">All equipment</option>
              {allEquipment
                .filter((eq) => {
                  if (componentFilterGroup) return eq.equipment_group_id === componentFilterGroup
                  if (componentFilterPlant) return eq.plant_id === componentFilterPlant
                  return true
                })
                .map((eq) => <option key={eq.id} value={eq.id}>{eq.equipment_name}</option>)}
            </select>
            <select
              className="input text-sm py-1.5 w-44"
              value={componentFilterStatus}
              onChange={(e) => { setComponentFilterStatus(e.target.value); setComponentPage(0) }}
            >
              <option value="">All statuses</option>
              <option value="Overdue">Overdue</option>
              <option value="Due Today">Due Today</option>
              <option value="Due Soon">Due Soon</option>
              <option value="On Schedule">On Schedule</option>
              <option value="Not Scheduled">Not Scheduled</option>
            </select>
            <button
              className="btn-primary btn-sm ml-auto"
              onClick={() => {
                setNewCompForm({ ...EMPTY_COMP_FORM, equipment_id: componentFilterEquip })
                setAddingComponent(true)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Component
            </button>
          </div>

          {/* Add component modal */}
          {addingComponent && (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
              onClick={() => { setAddingComponent(false); setNewCompFormPlant(null); setNewCompFormGroup(null) }}
            >
              <div className="card w-full max-w-5xl my-8 space-y-4" onClick={(e) => e.stopPropagation()}>
                {/* Modal header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">Add Component</h2>
                  <button
                    onClick={() => { setAddingComponent(false); setNewCompFormPlant(null); setNewCompFormGroup(null) }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid gap-4 lg:grid-cols-5">
                  {/* Row 1: plant/group filters + equipment + name + status */}
                  <div className="space-y-2">
                    <label className="label">Plant</label>
                    <select
                      className="input"
                      value={newCompFormPlant ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null
                        setNewCompFormPlant(val)
                        setNewCompFormGroup(null)
                        setNewCompForm((f) => ({ ...f, equipment_id: null }))
                      }}
                    >
                      <option value="">All plants</option>
                      {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="label">Group</label>
                    <select
                      className="input"
                      value={newCompFormGroup ?? ''}
                      disabled={!newCompFormPlant}
                      onChange={(e) => {
                        setNewCompFormGroup(e.target.value ? Number(e.target.value) : null)
                        setNewCompForm((f) => ({ ...f, equipment_id: null }))
                      }}
                    >
                      <option value="">{newCompFormPlant ? 'All groups' : 'Select plant first'}</option>
                      {newCompFormPlant
                        ? groups.filter((g) => g.plant_id === newCompFormPlant).map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))
                        : null}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="label">Equipment *</label>
                    <select
                      className="input"
                      value={newCompForm.equipment_id ?? ''}
                      onChange={(e) => setNewCompForm((f) => ({ ...f, equipment_id: e.target.value ? Number(e.target.value) : null }))}
                    >
                      <option value="">Select equipment</option>
                      {allEquipment
                        .filter((eq) => {
                          if (newCompFormGroup) return eq.equipment_group_id === newCompFormGroup
                          if (newCompFormPlant) return eq.plant_id === newCompFormPlant
                          return true
                        })
                        .map((eq) => <option key={eq.id} value={eq.id}>{eq.equipment_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="label">Component Name *</label>
                    <input type="text" className="input" placeholder="Component name" value={newCompForm.component_name} onChange={(e) => setNewCompForm((f) => ({ ...f, component_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="label">Status</label>
                    <select className="input" value={newCompForm.status} onChange={(e) => setNewCompForm((f) => ({ ...f, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  {/* Row 2: service fields */}
                  <div className="space-y-2">
                    <label className="label">Manufacturer</label>
                    <input type="text" className="input" value={newCompForm.manufacturer} onChange={(e) => setNewCompForm((f) => ({ ...f, manufacturer: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="label">Model Number</label>
                    <input type="text" className="input" value={newCompForm.model_number} onChange={(e) => setNewCompForm((f) => ({ ...f, model_number: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="label">Last Service Date</label>
                    <input type="date" className="input" value={newCompForm.last_service_date} onChange={(e) => setNewCompForm((f) => ({ ...f, last_service_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="label">Interval (days)</label>
                    <input type="number" min={1} className="input" value={newCompForm.service_interval_days ?? ''} onChange={(e) => setNewCompForm((f) => ({ ...f, service_interval_days: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="label">Next Service</label>
                    <div className="input bg-gray-50 text-sm text-gray-600 flex items-center">
                      {calculateNextServiceDate(newCompForm.last_service_date, newCompForm.service_interval_days) || '—'}
                    </div>
                  </div>

                  {/* Row 3: description + notes */}
                  <div className="lg:col-span-5 space-y-2">
                    <label className="label">Description</label>
                    <textarea className="input resize-none" rows={2} value={newCompForm.description} onChange={(e) => setNewCompForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="lg:col-span-5 space-y-2">
                    <label className="label">Notes</label>
                    <input type="text" className="input" value={newCompForm.notes} onChange={(e) => setNewCompForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>

                  <div className="lg:col-span-5 flex items-center gap-2">
                    <button
                      disabled={compFormSaving}
                      onClick={() => handleCreateComponent(newCompForm, () => {
                        setAddingComponent(false)
                        setNewCompForm({ ...EMPTY_COMP_FORM })
                        setNewCompFormPlant(null)
                        setNewCompFormGroup(null)
                        loadComponents()
                      })}
                      className="btn-primary flex items-center gap-1.5"
                    >
                      {compFormSaving ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                      Save
                    </button>
                    <button onClick={() => { setAddingComponent(false); setNewCompFormPlant(null); setNewCompFormGroup(null) }} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Components table */}
          {componentLoading ? (
            <div className="flex h-40 items-center justify-center"><LoadingSpinner size="lg" /></div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Component Name</th>
                    <th>Equipment</th>
                    <th>Plant</th>
                    <th>Manufacturer</th>
                    <th>Model No.</th>
                    <th>Last Service</th>
                    <th>Interval</th>
                    <th>Next Service</th>
                    <th>Service Status</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((comp) => (
                    <tr
                      key={comp.id}
                      className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                      onClick={() => {
                        setComponentDetailModal(comp)
                        setComponentModalEditing(false)
                      }}
                    >
                      <td className="font-medium">{comp.component_name}</td>
                      <td className="text-gray-600">{comp.equipment_name || '—'}</td>
                      <td className="text-gray-500">{comp.plant_name || '—'}</td>
                      <td className="text-sm text-gray-600">{comp.manufacturer || '—'}</td>
                      <td className="text-sm text-gray-600">{comp.model_number || '—'}</td>
                      <td className="text-sm text-gray-600">{comp.last_service_date || '—'}</td>
                      <td className="text-sm text-gray-600">{comp.service_interval_days ?? '—'}</td>
                      <td className="text-sm text-gray-600">{comp.next_service_date || '—'}</td>
                      <td>
                        <span className={`badge ${serviceStatusBadge(comp.service_status)}`}>
                          {comp.service_status || 'Not Scheduled'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${comp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {comp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {components.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center text-gray-400 py-8">No components found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalComponents > COMPONENT_PAGE_SIZE && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-500">
                Showing {componentPage * COMPONENT_PAGE_SIZE + 1}–{Math.min((componentPage + 1) * COMPONENT_PAGE_SIZE, totalComponents)} of {totalComponents}
              </span>
              <div className="flex items-center gap-2">
                <button className="btn-secondary btn-sm" onClick={() => setComponentPage((p) => Math.max(0, p - 1))} disabled={componentPage === 0}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="text-sm text-gray-600">Page {componentPage + 1} of {Math.ceil(totalComponents / COMPONENT_PAGE_SIZE)}</span>
                <button className="btn-secondary btn-sm" onClick={() => setComponentPage((p) => p + 1)} disabled={(componentPage + 1) * COMPONENT_PAGE_SIZE >= totalComponents}>
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Equipment Tab ────────────────────────────────────────────────────── */}
      {pageTab === 'equipment' && (
      <>
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
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
            onClick={() => setAddingEquip(false)}
          >
            <div className="card w-full max-w-5xl my-8 space-y-4" onClick={(e) => e.stopPropagation()}>
              {/* Modal header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Add Equipment</h2>
                <button onClick={() => setAddingEquip(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                {/* Row 1: identity + location + status */}
                <div className="space-y-2">
                  <label className="label">Name *</label>
                  <input type="text" className="input" placeholder="Equipment name" value={newEquipForm.name} onChange={(e) => setNewEquipForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="label">Code</label>
                  <input type="text" className="input" placeholder="Code" value={newEquipForm.code} onChange={(e) => setNewEquipForm((f) => ({ ...f, code: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="label">Plant</label>
                  <select
                    className="input"
                    value={newEquipForm.plant_id ?? ''}
                    onChange={(e) => setNewEquipForm((f) => ({ ...f, plant_id: e.target.value ? Number(e.target.value) : null, equipment_group_id: null }))}
                  >
                    <option value="">Unassigned</option>
                    {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="label">Group</label>
                  <select
                    className="input"
                    value={newEquipForm.equipment_group_id ?? ''}
                    disabled={!newEquipForm.plant_id}
                    onChange={(e) => setNewEquipForm((f) => ({ ...f, equipment_group_id: e.target.value ? Number(e.target.value) : null }))}
                  >
                    <option value="">No group</option>
                    {newEquipForm.plant_id
                      ? groups.filter((g) => g.plant_id === newEquipForm.plant_id).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)
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

                {/* Row 2: make / service schedule */}
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
                  <input type="number" min={1} className="input" value={newEquipForm.service_interval_days ?? ''} onChange={(e) => setNewEquipForm((f) => ({ ...f, service_interval_days: e.target.value ? Number(e.target.value) : null }))} />
                </div>

                {/* Row 3: computed + notes */}
                <div className="space-y-2">
                  <label className="label">Next Service</label>
                  <div className="input bg-gray-50 text-sm text-gray-600 flex items-center">
                    {calculateNextServiceDate(newEquipForm.last_service_date, newEquipForm.service_interval_days) || '—'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label">Service Status</label>
                  <div className="input bg-gray-50 text-sm text-gray-600 flex items-center">
                    {calculateServiceStatus(newEquipForm.last_service_date, newEquipForm.service_interval_days)}
                  </div>
                </div>
                <div className="lg:col-span-3 space-y-2">
                  <label className="label">Service Notes</label>
                  <input type="text" className="input" placeholder="Notes" value={newEquipForm.service_notes} onChange={(e) => setNewEquipForm((f) => ({ ...f, service_notes: e.target.value }))} />
                </div>

                {/* Row 4: description */}
                <div className="lg:col-span-5 space-y-2">
                  <label className="label">Description</label>
                  <textarea className="input resize-none" rows={2} placeholder="Equipment description" value={newEquipForm.description} onChange={(e) => setNewEquipForm((f) => ({ ...f, description: e.target.value }))} />
                </div>

                <div className="lg:col-span-5 flex items-center gap-2">
                  <button onClick={handleCreateEquip} className="btn-primary">Save</button>
                  <button onClick={() => setAddingEquip(false)} className="btn-secondary">Cancel</button>
                </div>
              </div>
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
                </tr>
              ))}
              {visibleEquipment.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center text-gray-400 py-8">
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

      </>) } {/* end equipment tab */}

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
                            onClick={() => {
                              setShowServiceForm(true)
                              setServiceFormSuccess('')
                              setCompleteForm({
                                service_date: '',
                                performed_by: '',
                                work_done: parseListField(equipmentActiveCard.work_to_be_done),
                                parts_used: parseListField(equipmentActiveCard.parts_required),
                                completion_notes: '',
                              })
                            }}
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
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-4">
                      <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Complete Service — <span className="font-mono">{equipmentActiveCard.job_card_number}</span>
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="label">Service Date *</label>
                          <input type="date" className="input" value={completeForm.service_date} onChange={(e) => setCompleteForm((f) => ({ ...f, service_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Performed By</label>
                          <input
                            type="text"
                            className="input"
                            placeholder={equipmentActiveCard?.assigned_artisan || ''}
                            value={completeForm.performed_by}
                            onChange={(e) => setCompleteForm((f) => ({ ...f, performed_by: e.target.value }))}
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Work Done</label>
                          <ListInput
                            items={completeForm.work_done}
                            onChange={(items) => setCompleteForm((f) => ({ ...f, work_done: items }))}
                            placeholder="Add completed task…"
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Parts Used</label>
                          <ListInput
                            items={completeForm.parts_used}
                            onChange={(items) => setCompleteForm((f) => ({ ...f, parts_used: items }))}
                            placeholder="Add part used…"
                          />
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
                          <label className="label">Priority</label>
                          <select className="input" value={serviceForm.priority} onChange={(e) => setServiceForm((f) => ({ ...f, priority: e.target.value }))}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="label">Start Date</label>
                          <input type="date" className="input" value={serviceForm.start_date} onChange={(e) => setServiceForm((f) => ({ ...f, start_date: e.target.value }))} />
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
                          <label className="label">Assigned By</label>
                          <input type="text" className="input" value={serviceForm.assigned_by} onChange={(e) => setServiceForm((f) => ({ ...f, assigned_by: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Service Description</label>
                          <textarea className="input resize-none" rows={2} value={serviceForm.service_description} onChange={(e) => setServiceForm((f) => ({ ...f, service_description: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Work To Be Done</label>
                          <ListInput items={serviceForm.work_to_be_done} onChange={(items) => setServiceForm((f) => ({ ...f, work_to_be_done: items }))} placeholder="Add task…" />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Parts Required</label>
                          <ListInput items={serviceForm.parts_required} onChange={(items) => setServiceForm((f) => ({ ...f, parts_required: items }))} placeholder="Add part…" />
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

                {/* Components section */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                      <Cpu className="h-4 w-4 text-gray-500" />
                      Components ({modalComponents.length})
                    </h3>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        setModalCompForm({ ...EMPTY_COMP_FORM, equipment_id: detailsModal!.id })
                        setAddingModalComp(true)
                        setEditingModalComp(null)
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>

                  {addingModalComp && (
                    <div className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="label">Component Name *</label>
                          <input type="text" className="input" value={modalCompForm.component_name} onChange={(e) => setModalCompForm((f) => ({ ...f, component_name: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Manufacturer</label>
                          <input type="text" className="input" value={modalCompForm.manufacturer} onChange={(e) => setModalCompForm((f) => ({ ...f, manufacturer: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Model Number</label>
                          <input type="text" className="input" value={modalCompForm.model_number} onChange={(e) => setModalCompForm((f) => ({ ...f, model_number: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Status</label>
                          <select className="input" value={modalCompForm.status} onChange={(e) => setModalCompForm((f) => ({ ...f, status: e.target.value }))}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="label">Last Service Date</label>
                          <input type="date" className="input" value={modalCompForm.last_service_date} onChange={(e) => setModalCompForm((f) => ({ ...f, last_service_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Interval (days)</label>
                          <input type="number" min={1} className="input" value={modalCompForm.service_interval_days ?? ''} onChange={(e) => setModalCompForm((f) => ({ ...f, service_interval_days: e.target.value ? Number(e.target.value) : null }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Notes</label>
                          <input type="text" className="input" value={modalCompForm.notes} onChange={(e) => setModalCompForm((f) => ({ ...f, notes: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={modalCompSaving}
                          onClick={async () => {
                            if (!modalCompForm.component_name.trim() || !detailsModal?.id) return
                            setModalCompSaving(true)
                            try {
                              await createComponent({
                                equipment_id: detailsModal.id,
                                component_name: modalCompForm.component_name.trim(),
                                manufacturer: modalCompForm.manufacturer || null,
                                model_number: modalCompForm.model_number || null,
                                last_service_date: modalCompForm.last_service_date || null,
                                service_interval_days: modalCompForm.service_interval_days,
                                notes: modalCompForm.notes || null,
                                status: modalCompForm.status,
                              })
                              setAddingModalComp(false)
                              setModalCompForm({ ...EMPTY_COMP_FORM })
                              loadModalComponents(detailsModal.id)
                            } catch (e: any) {
                              setDetailsModalError(e?.response?.data?.detail || 'Failed to save component')
                            } finally {
                              setModalCompSaving(false)
                            }
                          }}
                          className="btn-primary flex items-center gap-1.5"
                        >
                          {modalCompSaving ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                          Save Component
                        </button>
                        <button onClick={() => setAddingModalComp(false)} className="btn-secondary">Cancel</button>
                      </div>
                    </div>
                  )}

                  {modalCompLoading ? (
                    <div className="flex h-16 items-center justify-center"><LoadingSpinner /></div>
                  ) : modalComponents.length === 0 ? (
                    <p className="text-xs text-gray-400">No components linked to this equipment.</p>
                  ) : (
                    <div className="table-container">
                      <table className="table text-sm">
                        <thead>
                          <tr>
                            <th>Component</th>
                            <th>Manufacturer</th>
                            <th>Last Service</th>
                            <th>Next Service</th>
                            <th>Service Status</th>
                            <th>Status</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalComponents.map((comp) => (
                            <tr key={comp.id}>
                              {editingModalComp?.id === comp.id ? (
                                <>
                                  <td><input type="text" className="input text-sm py-1" value={editModalCompForm.component_name} onChange={(e) => setEditModalCompForm((f) => ({ ...f, component_name: e.target.value }))} /></td>
                                  <td><input type="text" className="input text-sm py-1" value={editModalCompForm.manufacturer} onChange={(e) => setEditModalCompForm((f) => ({ ...f, manufacturer: e.target.value }))} /></td>
                                  <td><input type="date" className="input text-sm py-1" value={editModalCompForm.last_service_date} onChange={(e) => setEditModalCompForm((f) => ({ ...f, last_service_date: e.target.value }))} /></td>
                                  <td className="text-gray-600">{calculateNextServiceDate(editModalCompForm.last_service_date, editModalCompForm.service_interval_days) || '—'}</td>
                                  <td className="text-gray-600">{calculateServiceStatus(editModalCompForm.last_service_date, editModalCompForm.service_interval_days)}</td>
                                  <td>
                                    <select className="input text-sm py-1" value={editModalCompForm.status} onChange={(e) => setEditModalCompForm((f) => ({ ...f, status: e.target.value }))}>
                                      <option value="active">Active</option>
                                      <option value="inactive">Inactive</option>
                                    </select>
                                  </td>
                                  <td>
                                    <div className="flex items-center gap-1">
                                      <button
                                        disabled={modalCompSaving}
                                        onClick={async () => {
                                          if (!detailsModal?.id) return
                                          setModalCompSaving(true)
                                          try {
                                            await updateComponent(comp.id, {
                                              component_name: editModalCompForm.component_name.trim(),
                                              manufacturer: editModalCompForm.manufacturer || null,
                                              last_service_date: editModalCompForm.last_service_date || null,
                                              service_interval_days: editModalCompForm.service_interval_days,
                                              status: editModalCompForm.status,
                                            })
                                            setEditingModalComp(null)
                                            loadModalComponents(detailsModal.id)
                                          } catch (e: any) {
                                            setDetailsModalError(e?.response?.data?.detail || 'Failed to update component')
                                          } finally {
                                            setModalCompSaving(false)
                                          }
                                        }}
                                        className="text-green-600 hover:text-green-700"
                                      ><Check className="h-4 w-4" /></button>
                                      <button onClick={() => setEditingModalComp(null)} className="text-gray-400"><X className="h-4 w-4" /></button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="font-medium">{comp.component_name}</td>
                                  <td className="text-gray-600">{comp.manufacturer || '—'}</td>
                                  <td className="text-gray-600">{comp.last_service_date || '—'}</td>
                                  <td className="text-gray-600">{comp.next_service_date || '—'}</td>
                                  <td>
                                    <span className={`badge ${serviceStatusBadge(comp.service_status)}`}>
                                      {comp.service_status || 'Not Scheduled'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`badge ${comp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                      {comp.status}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          setEditingModalComp(comp)
                                          setEditModalCompForm({
                                            equipment_id: comp.equipment_id,
                                            component_name: comp.component_name,
                                            manufacturer: comp.manufacturer || '',
                                            model_number: comp.model_number || '',
                                            description: comp.description || '',
                                            last_service_date: comp.last_service_date || '',
                                            service_interval_days: comp.service_interval_days,
                                            notes: comp.notes || '',
                                            status: comp.status,
                                          })
                                          setAddingModalComp(false)
                                        }}
                                        className="text-gray-400 hover:text-blue-600"
                                      ><Pencil className="h-3.5 w-3.5" /></button>
                                      <button
                                        onClick={() => handleDeleteComponent(comp.id, () => detailsModal?.id && loadModalComponents(detailsModal.id))}
                                        className="text-gray-400 hover:text-red-600"
                                      ><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

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
                            <tr key={s.id} className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                              onClick={() => {
                                setDetailsModal(null)
                                setModalEditing(false)
                                navigate('/service-now', { state: { openServiceHistoryId: s.id } })
                              }}>
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
                            <tr key={r.id} className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                              onClick={() => {
                                setDetailsModal(null)
                                setModalEditing(false)
                                navigate('/records', { state: { openRecordId: r.id } })
                              }}>
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

      {/* ── Component Details Modal ──────────────────────────────────────── */}
      {componentDetailModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => { setComponentDetailModal(null); setComponentModalEditing(false) }}
        >
          <div
            className="card w-full max-w-2xl my-8 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">{componentDetailModal.component_name}</h2>
                {componentDetailModal.equipment_name && (
                  <p className="text-sm text-gray-500 mt-0.5">{componentDetailModal.equipment_name}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!componentModalEditing && (
                  <>
                    {componentActiveCard ? (
                      <button
                        title={`Mark complete — ${componentActiveCard.job_card_number}`}
                        onClick={() => {
                          setShowCompServiceForm(true)
                          setCompServiceFormSuccess('')
                          setCompCompleteForm({
                            service_date: '',
                            performed_by: '',
                            work_done: parseListField(componentActiveCard.work_to_be_done),
                            parts_used: parseListField(componentActiveCard.parts_required),
                            completion_notes: '',
                          })
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Mark Complete
                      </button>
                    ) : (
                      <button
                        title="Create service job card"
                        onClick={() => {
                          setCompServiceFormSuccess('')
                          setCompServiceForm((f) => ({ ...f, due_date: componentDetailModal.next_service_date || '' }))
                          setShowCompServiceForm((v) => !v)
                        }}
                        className={`p-1.5 rounded transition-colors ${showCompServiceForm ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                      >
                        <Zap className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      title="Edit component"
                      onClick={() => {
                        setEditCompForm({
                          equipment_id: componentDetailModal.equipment_id,
                          component_name: componentDetailModal.component_name,
                          manufacturer: componentDetailModal.manufacturer || '',
                          model_number: componentDetailModal.model_number || '',
                          description: componentDetailModal.description || '',
                          last_service_date: componentDetailModal.last_service_date || '',
                          service_interval_days: componentDetailModal.service_interval_days,
                          notes: componentDetailModal.notes || '',
                          status: componentDetailModal.status,
                        })
                        setComponentModalEditing(true)
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      title="Delete component"
                      onClick={() => {
                        const id = componentDetailModal.id
                        setComponentDetailModal(null)
                        setComponentModalEditing(false)
                        handleDeleteComponent(id, loadComponents)
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setComponentDetailModal(null); setComponentModalEditing(false) }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors ml-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {componentModalEditing ? (
              /* ── Edit form inside modal ── */
              <div className="border-t pt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="label">Component Name *</label>
                    <input type="text" className="input" value={editCompForm.component_name} onChange={(e) => setEditCompForm((f) => ({ ...f, component_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Manufacturer</label>
                    <input type="text" className="input" value={editCompForm.manufacturer} onChange={(e) => setEditCompForm((f) => ({ ...f, manufacturer: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Model Number</label>
                    <input type="text" className="input" value={editCompForm.model_number} onChange={(e) => setEditCompForm((f) => ({ ...f, model_number: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Status</label>
                    <select className="input" value={editCompForm.status} onChange={(e) => setEditCompForm((f) => ({ ...f, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="label">Last Service Date</label>
                    <input type="date" className="input" value={editCompForm.last_service_date} onChange={(e) => setEditCompForm((f) => ({ ...f, last_service_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Interval (days)</label>
                    <input type="number" min={1} className="input" value={editCompForm.service_interval_days ?? ''} onChange={(e) => setEditCompForm((f) => ({ ...f, service_interval_days: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Next Service</label>
                    <div className="text-sm text-gray-700 py-2">{calculateNextServiceDate(editCompForm.last_service_date, editCompForm.service_interval_days) || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="label">Service Status</label>
                    <div className="text-sm text-gray-700 py-2">{calculateServiceStatus(editCompForm.last_service_date, editCompForm.service_interval_days)}</div>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="label">Description</label>
                    <textarea className="input resize-none" rows={2} value={editCompForm.description} onChange={(e) => setEditCompForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="label">Notes</label>
                    <input type="text" className="input" value={editCompForm.notes} onChange={(e) => setEditCompForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    disabled={compFormSaving}
                    onClick={() =>
                      handleUpdateComponent(componentDetailModal.id, editCompForm, () => {
                        const updated: EquipmentComponent = {
                          ...componentDetailModal,
                          component_name: editCompForm.component_name,
                          manufacturer: editCompForm.manufacturer || null,
                          model_number: editCompForm.model_number || null,
                          description: editCompForm.description || null,
                          last_service_date: editCompForm.last_service_date || null,
                          service_interval_days: editCompForm.service_interval_days,
                          notes: editCompForm.notes || null,
                          status: editCompForm.status,
                          next_service_date: calculateNextServiceDate(editCompForm.last_service_date, editCompForm.service_interval_days) || null,
                          service_status: calculateServiceStatus(editCompForm.last_service_date, editCompForm.service_interval_days),
                        }
                        setComponentDetailModal(updated)
                        setComponentModalEditing(false)
                        loadComponents()
                      })
                    }
                    className="btn-primary flex items-center gap-1.5"
                  >
                    {compFormSaving ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                    Save changes
                  </button>
                  <button
                    onClick={() => setComponentModalEditing(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ── View mode ── */
              <div className="border-t pt-4 space-y-4">

                {compServiceFormError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{compServiceFormError}</div>
                )}
                {compServiceFormSuccess && (
                  <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center justify-between">
                    {compServiceFormSuccess}
                    <button onClick={() => setCompServiceFormSuccess('')}><X className="h-4 w-4" /></button>
                  </div>
                )}

                {/* Service job card form */}
                {showCompServiceForm && (
                  componentActiveCard ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-4">
                      <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Complete Service — <span className="font-mono">{componentActiveCard.job_card_number}</span>
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="label">Service Date *</label>
                          <input type="date" className="input" value={compCompleteForm.service_date} onChange={(e) => setCompCompleteForm((f) => ({ ...f, service_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Performed By</label>
                          <input type="text" className="input" placeholder={componentActiveCard.assigned_artisan || ''} value={compCompleteForm.performed_by} onChange={(e) => setCompCompleteForm((f) => ({ ...f, performed_by: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Work Done</label>
                          <ListInput items={compCompleteForm.work_done} onChange={(items) => setCompCompleteForm((f) => ({ ...f, work_done: items }))} placeholder="Add completed task…" />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Parts Used</label>
                          <ListInput items={compCompleteForm.parts_used} onChange={(items) => setCompCompleteForm((f) => ({ ...f, parts_used: items }))} placeholder="Add part used…" />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Completion Notes</label>
                          <textarea className="input resize-none" rows={2} value={compCompleteForm.completion_notes} onChange={(e) => setCompCompleteForm((f) => ({ ...f, completion_notes: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleCompleteCompJobCard} disabled={compCompleting} className="btn-primary flex items-center gap-1.5">
                          {compCompleting ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                          Confirm Complete
                        </button>
                        <button onClick={() => setShowCompServiceForm(false)} className="btn-secondary">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-green-600" />
                        Create Service Job Card
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="label">Service Type</label>
                          <input type="text" className="input" value={compServiceForm.service_type} onChange={(e) => setCompServiceForm((f) => ({ ...f, service_type: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Priority</label>
                          <select className="input" value={compServiceForm.priority} onChange={(e) => setCompServiceForm((f) => ({ ...f, priority: e.target.value }))}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="label">Start Date</label>
                          <input type="date" className="input" value={compServiceForm.start_date} onChange={(e) => setCompServiceForm((f) => ({ ...f, start_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Due Date</label>
                          <input type="date" className="input" value={compServiceForm.due_date} onChange={(e) => setCompServiceForm((f) => ({ ...f, due_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Assigned Artisan</label>
                          <input type="text" className="input" value={compServiceForm.assigned_artisan} onChange={(e) => setCompServiceForm((f) => ({ ...f, assigned_artisan: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Assigned By</label>
                          <input type="text" className="input" value={compServiceForm.assigned_by} onChange={(e) => setCompServiceForm((f) => ({ ...f, assigned_by: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Service Description</label>
                          <textarea className="input resize-none" rows={2} value={compServiceForm.service_description} onChange={(e) => setCompServiceForm((f) => ({ ...f, service_description: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Work To Be Done</label>
                          <ListInput items={compServiceForm.work_to_be_done} onChange={(items) => setCompServiceForm((f) => ({ ...f, work_to_be_done: items }))} placeholder="Add task…" />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Parts Required</label>
                          <ListInput items={compServiceForm.parts_required} onChange={(items) => setCompServiceForm((f) => ({ ...f, parts_required: items }))} placeholder="Add part…" />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="label">Notes</label>
                          <textarea className="input resize-none" rows={2} value={compServiceForm.notes} onChange={(e) => setCompServiceForm((f) => ({ ...f, notes: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleCreateCompJobCard} disabled={compServiceFormSaving} className="btn-primary flex items-center gap-1.5">
                          {compServiceFormSaving ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                          Save Job Card
                        </button>
                        <button onClick={() => setShowCompServiceForm(false)} className="btn-secondary">Cancel</button>
                      </div>
                    </div>
                  )
                )}

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <InfoField label="Equipment" value={componentDetailModal.equipment_name} />
                  <InfoField label="Plant" value={componentDetailModal.plant_name} />
                  <InfoField label="Manufacturer" value={componentDetailModal.manufacturer} />
                  <InfoField label="Model Number" value={componentDetailModal.model_number} />
                  <InfoField label="Last Service" value={componentDetailModal.last_service_date} />
                  <InfoField label="Interval" value={componentDetailModal.service_interval_days != null ? `${componentDetailModal.service_interval_days} days` : null} />
                  <InfoField label="Next Service" value={componentDetailModal.next_service_date} />
                  <InfoField label="Service Status">
                    <span className={`badge ${serviceStatusBadge(componentDetailModal.service_status)}`}>
                      {componentDetailModal.service_status || 'Not Scheduled'}
                    </span>
                  </InfoField>
                  <InfoField label="Status">
                    <span className={`badge ${componentDetailModal.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {componentDetailModal.status}
                    </span>
                  </InfoField>
                </div>
                {componentDetailModal.description && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{componentDetailModal.description}</p>
                  </div>
                )}
                {componentDetailModal.notes && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{componentDetailModal.notes}</p>
                  </div>
                )}

                {/* Service history */}
                <div className="border-t pt-4 space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Service History</h3>
                  {componentModalHistoryLoading ? (
                    <div className="flex h-10 items-center justify-center"><LoadingSpinner /></div>
                  ) : componentModalHistory.length === 0 ? (
                    <p className="text-xs text-gray-400">No service history recorded for this component.</p>
                  ) : (
                    <div className="table-container">
                      <table className="table text-sm">
                        <thead>
                          <tr>
                            <th>Job Card</th>
                            <th>Completed</th>
                            <th>Type</th>
                            <th>Performed By</th>
                            <th>Work Done</th>
                          </tr>
                        </thead>
                        <tbody>
                          {componentModalHistory.map((jc) => (
                            <tr key={jc.id}>
                              <td className="font-mono text-xs text-gray-500">{jc.job_card_number}</td>
                              <td className="text-gray-600">{jc.completed_date || '—'}</td>
                              <td className="text-gray-600">{jc.service_type || '—'}</td>
                              <td className="text-gray-600">{jc.assigned_artisan || '—'}</td>
                              <td className="text-gray-500 max-w-[180px] truncate">{jc.work_to_be_done || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
