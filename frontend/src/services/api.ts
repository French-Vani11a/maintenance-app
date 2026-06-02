import axios from 'axios'
import type {
  AuditLog,
  DashboardStats,
  DueEquipment,
  EnrichedServiceHistory,
  Equipment,
  EquipmentDetails,
  EquipmentGroup,
  FaultCategory,
  JobCardsResponse,
  MaintenanceRecord,
  PartsReplacement,
  Plant,
  RecordFilters,
  RecordsResponse,
  ServiceDashboardStats,
  ServiceHistory,
  ServiceHistoryResponse,
  ServiceJobCard,
  User,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<string> {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  const res = await api.post<{ access_token: string; token_type: string }>(
    '/auth/login',
    form,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  return res.data.access_token
}

export async function getMe(): Promise<User> {
  const res = await api.get<User>('/auth/me')
  return res.data
}

// ── Plants ──────────────────────────────────────────────────────────────────

export async function getPlants(): Promise<Plant[]> {
  const res = await api.get<Plant[]>('/plants/')
  return res.data
}

export async function createPlant(name: string): Promise<Plant> {
  const res = await api.post<Plant>('/plants/', { name })
  return res.data
}

export async function updatePlant(id: number, name: string): Promise<Plant> {
  const res = await api.put<Plant>(`/plants/${id}`, { name })
  return res.data
}

export async function deletePlant(id: number): Promise<void> {
  await api.delete(`/plants/${id}`)
}

// ── Equipment ───────────────────────────────────────────────────────────────

export async function getEquipment(params?: {
  skip?: number
  limit?: number
  plant_id?: number
  equipment_group_id?: number
  status?: string
  search?: string
}): Promise<{ total: number; equipment: Equipment[] }> {
  const res = await api.get<{ total: number; equipment: Equipment[] }>('/equipment/', { params })
  return res.data
}

export async function createEquipment(data: Partial<Equipment>): Promise<Equipment> {
  const res = await api.post<Equipment>('/equipment/', data)
  return res.data
}

export async function updateEquipment(id: number, data: Partial<Equipment>): Promise<Equipment> {
  const res = await api.put<Equipment>(`/equipment/${id}`, data)
  return res.data
}

export async function deleteEquipment(id: number): Promise<void> {
  await api.delete(`/equipment/${id}`)
}

export async function getEquipmentDetails(id: number): Promise<EquipmentDetails> {
  const res = await api.get<EquipmentDetails>(`/equipment/${id}/details`)
  return res.data
}

export async function getEquipmentGroups(plant_id?: number): Promise<EquipmentGroup[]> {
  const res = await api.get<EquipmentGroup[]>('/equipment/groups/', {
    params: plant_id ? { plant_id } : {},
  })
  return res.data
}

export async function createEquipmentGroup(data: Partial<EquipmentGroup>): Promise<EquipmentGroup> {
  const res = await api.post<EquipmentGroup>('/equipment/groups/', data)
  return res.data
}

export async function updateEquipmentGroup(id: number, data: Partial<EquipmentGroup>): Promise<EquipmentGroup> {
  const res = await api.put<EquipmentGroup>(`/equipment/groups/${id}`, data)
  return res.data
}

export async function deleteEquipmentGroup(id: number): Promise<void> {
  await api.delete(`/equipment/groups/${id}`)
}
// ── Service History ─────────────────────────────────────────────────────────

export async function getServiceHistory(equipment_id: number): Promise<ServiceHistory[]> {
  const res = await api.get<{ total: number; records: ServiceHistory[] }>('/service-history/', { params: { equipment_id } })
  return res.data.records
}

export async function getEnrichedServiceHistory(params: {
  equipment_id?: number
  plant_id?: number
  date_from?: string
  date_to?: string
  artisan?: string
  service_type?: string
  search?: string
  skip?: number
  limit?: number
}): Promise<ServiceHistoryResponse> {
  const res = await api.get<ServiceHistoryResponse>('/service-history/', { params })
  return res.data
}

export async function createServiceHistory(data: Partial<ServiceHistory>): Promise<ServiceHistory> {
  const res = await api.post<ServiceHistory>('/service-history/', data)
  return res.data
}

// ── Service Job Cards ────────────────────────────────────────────────────────

export async function getDueEquipment(params?: {
  search?: string
  plant_id?: number
}): Promise<DueEquipment[]> {
  const res = await api.get<DueEquipment[]>('/job-cards/due-equipment', { params })
  return res.data
}

export async function searchAllEquipment(search: string, plant_id?: number): Promise<DueEquipment[]> {
  const res = await api.get<DueEquipment[]>('/job-cards/search-equipment', { params: { search, plant_id } })
  return res.data
}

export async function getJobCards(params?: {
  status?: string
  plant_id?: number
  equipment_id?: number
  priority?: string
  search?: string
  skip?: number
  limit?: number
}): Promise<JobCardsResponse> {
  const res = await api.get<JobCardsResponse>('/job-cards/', { params })
  return res.data
}

export async function createJobCard(data: {
  equipment_id: number
  plant_id?: number | null
  service_type?: string | null
  due_date?: string | null
  service_description?: string | null
  work_to_be_done?: string | null
  assigned_artisan?: string | null
  parts_required?: string | null
  priority?: string
  notes?: string | null
}): Promise<ServiceJobCard> {
  const res = await api.post<ServiceJobCard>('/job-cards/', data)
  return res.data
}

export async function updateJobCard(id: number, data: Partial<ServiceJobCard>): Promise<ServiceJobCard> {
  const res = await api.put<ServiceJobCard>(`/job-cards/${id}`, data)
  return res.data
}

export async function completeJobCard(id: number, data: {
  service_date: string
  performed_by?: string | null
  work_done?: string | null
  parts_used?: string | null
  completion_notes?: string | null
}): Promise<ServiceJobCard> {
  const res = await api.post<ServiceJobCard>(`/job-cards/${id}/complete`, data)
  return res.data
}

export async function deleteJobCard(id: number): Promise<void> {
  await api.delete(`/job-cards/${id}`)
}

// ── Parts Replacements ───────────────────────────────────────────────────────

export async function getPartsReplacements(equipment_id: number): Promise<PartsReplacement[]> {
  const res = await api.get<PartsReplacement[]>('/parts-replacements/', { params: { equipment_id } })
  return res.data
}

export async function createPartsReplacement(data: Partial<PartsReplacement>): Promise<PartsReplacement> {
  const res = await api.post<PartsReplacement>('/parts-replacements/', data)
  return res.data
}
// ── Users ───────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  const res = await api.get<User[]>('/users/')
  return res.data
}

export async function createUser(data: {
  full_name: string
  email: string
  password: string
  role: string
}): Promise<User> {
  const res = await api.post<User>('/users/', data)
  return res.data
}

export async function updateUser(id: number, data: Partial<User & { password: string; email: string }>): Promise<User> {
  const res = await api.put<User>(`/users/${id}`, data)
  return res.data
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`)
}

export async function changeMyPassword(data: { current_password: string; new_password: string }): Promise<void> {
  await api.put('/users/me/password', data)
}

// ── Fault Categories ─────────────────────────────────────────────────────────

export async function getFaultCategories(): Promise<FaultCategory[]> {
  // stored inline with records – future endpoint
  return []
}

// ── Maintenance Records ──────────────────────────────────────────────────────

export async function getRecords(
  filters: RecordFilters & { skip?: number; limit?: number }
): Promise<RecordsResponse> {
  const res = await api.get<RecordsResponse>('/records/', { params: filters })
  return res.data
}

export async function getRecord(id: number): Promise<MaintenanceRecord> {
  const res = await api.get<MaintenanceRecord>(`/records/${id}`)
  return res.data
}

export async function createRecord(data: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
  const res = await api.post<MaintenanceRecord>('/records/', data)
  return res.data
}

export async function updateRecord(
  id: number,
  data: Partial<MaintenanceRecord>
): Promise<MaintenanceRecord> {
  const res = await api.put<MaintenanceRecord>(`/records/${id}`, data)
  return res.data
}

export async function deleteRecord(id: number): Promise<void> {
  await api.delete(`/records/${id}`)
}

export async function exportRecordsCsv(filters: RecordFilters): Promise<{ blob: Blob; filename: string }> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.append(k, String(v))
  })

  const res = await api.get(`/records/export/csv?${params.toString()}`, {
    responseType: 'blob',
  })

  const disposition = res.headers['content-disposition'] as string | undefined
  const filenameMatch = disposition?.match(/filename=\"?([^\";]+)\"?/i)
  const filename = filenameMatch?.[1] || `maintenance_records_${new Date().toISOString().slice(0, 10)}.csv`

  return { blob: res.data, filename }
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(month?: number, year?: number): Promise<DashboardStats> {
  const res = await api.get<DashboardStats>('/dashboard/stats', {
    params: { month, year },
  })
  return res.data
}

export async function getServiceDashboardStats(): Promise<ServiceDashboardStats> {
  const res = await api.get<ServiceDashboardStats>('/service-dashboard/stats')
  return res.data
}

export async function getDashboardStatsByDateRange(
  date_from?: string,
  date_to?: string
): Promise<DashboardStats> {
  const res = await api.get<DashboardStats>('/dashboard/stats', {
    params: { date_from, date_to },
  })
  return res.data
}

export async function getDowntimeByEquipmentForPlant(
  plant_id: number,
  date_from?: string,
  date_to?: string
): Promise<Array<{ name: string; total_downtime: number; fault_count: number }>> {
  const res = await api.get('/dashboard/equipment-downtime', {
    params: { plant_id, date_from, date_to },
  })
  return res.data
}

// ── Import ───────────────────────────────────────────────────────────────────

export async function previewImport(
  file: File,
  sheetName?: string
): Promise<{
  sheets: string[]
  selected_sheet: string
  total_records: number
  preview: Record<string, unknown>[]
}> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/import/preview', form, {
    params: sheetName ? { sheet_name: sheetName } : {},
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function commitImport(
  file: File,
  sheetName?: string
): Promise<{ saved: number; created: number; updated: number; errors: { row: number; error: string }[]; message: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/import/commit', form, {
    params: sheetName ? { sheet_name: sheetName } : {},
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// ── Audit Logs ───────────────────────────────────────────────────────────────

export async function getAuditLogs(params?: {
  skip?: number
  limit?: number
  date_from?: string
  date_to?: string
  user_id?: number
  action?: string
  item_type?: string
}): Promise<AuditLog[]> {
  const res = await api.get<AuditLog[]>('/logs/', { params })
  return res.data
}

export default api
