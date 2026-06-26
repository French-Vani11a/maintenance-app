export interface Plant {
  id: number
  name: string
}

export interface Equipment {
  id: number
  equipment_name: string
  equipment_code: string | null
  plant_id: number | null
  plant_name: string | null
  equipment_group_id: number | null
  equipment_group_name: string | null
  status: string
  last_service_date?: string | null
  service_interval_days?: number | null
  next_service_date?: string | null
  service_type?: string | null
  service_notes?: string | null
  service_status?: string
  manufacturer?: string | null
  model_number?: string | null
  description?: string | null
}

export interface EquipmentDetails extends Equipment {
  recent_service_histories: Array<{
    id: number
    service_date: string
    service_type: string | null
    performed_by: string | null
    notes: string | null
  }>
  recent_maintenance_records: Array<{
    id: number
    record_date: string
    mr_no: string | null
    issue_description: string | null
    status: string
    artisan_name: string | null
    downtime_minutes: number
    reporter_name: string | null
  }>
}

export interface EquipmentGroup {
  id: number
  name: string
  plant_id: number | null
  plant_name: string | null
}

export interface User {
  id: number
  full_name: string
  username: string
  role: string
  is_active: boolean
}

export interface ServiceHistory {
  id: number
  equipment_id: number
  service_date: string
  service_type: string | null
  performed_by: string | null
  notes: string | null
  created_at: string | null
}

export interface PartsReplacement {
  id: number
  equipment_id: number
  part_name: string
  interval_days: number | null
  last_replacement_date: string | null
  next_replacement_date: string | null
  replacement_status: string | null
  notes: string | null
  created_at: string | null
}

export interface ServiceDashboardStats {
  overdue_count: number
  due_today_count: number
  due_soon_count: number
  upcoming_count: number
  not_scheduled_count: number
  completed_this_month: number
  overdue_component_count: number
  due_today_component_count: number
  due_soon_component_count: number
  upcoming_component_count: number
  not_scheduled_component_count: number
  status_breakdown: Array<{ status: string; count: number }>
  overdue_by_plant: Array<{ id: number; name: string; overdue_count: number }>
  due_today_services: Array<{
    id: number
    equipment_name: string
    plant_name: string | null
    next_service_date: string | null
    status: string
    item_type: 'equipment'
  }>
  upcoming_services: Array<{
    id: number
    equipment_name: string
    plant_name: string | null
    next_service_date: string | null
    status: string
    item_type: 'equipment'
  }>
  overdue_services: Array<{
    id: number
    equipment_name: string
    plant_name: string | null
    next_service_date: string | null
    status: string
    item_type: 'equipment'
  }>
  overdue_component_services: Array<{
    id: number
    equipment_id: number
    component_name: string
    equipment_name: string
    plant_name: string | null
    next_service_date: string | null
    status: string
    item_type: 'component'
  }>
  due_today_component_services: Array<{
    id: number
    equipment_id: number
    component_name: string
    equipment_name: string
    plant_name: string | null
    next_service_date: string | null
    status: string
    item_type: 'component'
  }>
  upcoming_component_services: Array<{
    id: number
    equipment_id: number
    component_name: string
    equipment_name: string
    plant_name: string | null
    next_service_date: string | null
    status: string
    item_type: 'component'
  }>
}

export interface EquipmentComponent {
  id: number
  equipment_id: number
  equipment_name: string | null
  plant_id: number | null
  plant_name: string | null
  component_name: string
  manufacturer: string | null
  model_number: string | null
  description: string | null
  last_service_date: string | null
  service_interval_days: number | null
  next_service_date: string | null
  service_status: string
  notes: string | null
  status: string
  created_at: string | null
}

export interface EquipmentComponentsResponse {
  total: number
  components: EquipmentComponent[]
}

export interface FaultCategory {
  id: number
  name: string
}

export interface MaintenanceRecord {
  id: number
  record_date: string
  time_reported: string | null
  reporter_name: string | null
  reported_to: string | null
  artisan_name: string | null
  mr_no: string | null
  plant_id: number | null
  plant_name: string | null
  equipment_id: number | null
  equipment_name: string | null
  equipment_group_id: number | null
  equipment_group_name: string | null
  issue_description: string | null
  arrival_time: string | null
  finishing_time: string | null
  downtime_minutes: number
  run_time_minutes: number | null
  is_slicer: boolean
  prev_hr_meter: number | null
  curr_hr_meter: number | null
  remarks: string | null
  status: string
  record_type: string
  fault_category_id: number | null
  fault_category_name: string | null
  created_by_user_id: number | null
  created_by_user_name: string | null
  created_at: string | null
  updated_at: string | null
}

export interface RecordsResponse {
  total: number
  records: MaintenanceRecord[]
}

export interface DowntimeByEquipment {
  id: number
  name: string
  total_downtime: number
  fault_count: number
}

export interface DashboardStats {
  month: number
  year: number
  total_faults: number
  open_faults: number
  in_progress_faults: number
  closed_faults: number
  total_downtime_minutes: number
  avg_repair_time_minutes: number
  top_equipment: Array<{ name: string; fault_count: number; total_downtime: number }>
  downtime_by_plant: Array<{ id: number; name: string; total_downtime: number; fault_count: number }>
  equipment_group_faults: Array<{ name: string; fault_count: number; total_downtime: number }>
  faults_by_day: Array<{ date: string; count: number; downtime: number }>
  top_artisans: Array<{ name: string; job_count: number; total_downtime: number }>
}

export interface RecordFilters {
  date_from?: string
  date_to?: string
  plant_id?: number
  equipment_id?: number
  equipment_group_id?: number
  created_by?: string
  artisan_name?: string
  reporter_name?: string
  mr_no?: string
  status?: string
  record_type?: string
  search?: string
}

export interface DueEquipment {
  id: number
  equipment_name: string
  equipment_code: string | null
  plant_id: number | null
  plant_name: string | null
  service_type: string | null
  last_service_date: string | null
  next_service_date: string | null
  service_status: string
  service_interval_days: number | null
  manufacturer: string | null
  model_number: string | null
}

export interface ServiceJobCard {
  id: number
  job_card_number: string
  equipment_id: number
  equipment_name: string | null
  equipment_code: string | null
  component_id: number | null
  component_name: string | null
  plant_id: number | null
  plant_name: string | null
  service_type: string | null
  due_date: string | null
  service_description: string | null
  work_to_be_done: string | null
  assigned_artisan: string | null
  assigned_by: string | null
  start_date: string | null
  parts_required: string | null
  priority: string
  notes: string | null
  status: string
  completed_date: string | null
  created_by_user_id: number | null
  created_by_user_name: string | null
  created_at: string | null
}

export interface EnrichedServiceHistory {
  id: number
  equipment_id: number
  equipment_name: string | null
  equipment_code: string | null
  plant_id: number | null
  plant_name: string | null
  equipment_group_id: number | null
  equipment_group_name: string | null
  service_date: string
  service_type: string | null
  performed_by: string | null
  notes: string | null
  work_done: string | null
  parts_used: string | null
  job_card_id: number | null
  job_card_number: string | null
  component_id: number | null
  component_name: string | null
  created_at: string | null
}

export interface ServiceHistoryResponse {
  total: number
  records: EnrichedServiceHistory[]
}

export interface JobCardsResponse {
  total: number
  job_cards: ServiceJobCard[]
}

export interface AuditLog {
  id: number
  user_id: number
  user_name: string
  action: string
  item_type: string
  item_id: number | null
  details: string | null
  timestamp: string
}
