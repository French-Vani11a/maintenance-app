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
  issue_description: string | null
  arrival_time: string | null
  finishing_time: string | null
  downtime_minutes: number
  remarks: string | null
  status: string
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
  search?: string
}
