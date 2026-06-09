import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, ClipboardList, Clock, X } from 'lucide-react'
import { getJobCards, getServiceDashboardStats } from '../services/api'
import type { ServiceDashboardStats, ServiceJobCard } from '../types'
import LoadingSpinner from './LoadingSpinner'

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<ServiceDashboardStats | null>(null)
  const [activeCards, setActiveCards] = useState<ServiceJobCard[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  function goToEquipment(equipmentId: number) {
    setOpen(false)
    navigate('/equipment', { state: { openEquipmentId: equipmentId } })
  }

  function goToJobCard(card: ServiceJobCard) {
    setOpen(false)
    navigate('/service-now', { state: { openJobCard: card } })
  }

  // Load counts on mount for the badge
  useEffect(() => { fetchData() }, [])

  // Close when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function fetchData() {
    try {
      const [s, jc] = await Promise.all([
        getServiceDashboardStats(),
        getJobCards({ limit: 100 }),
      ])
      setStats(s)
      setActiveCards(jc.job_cards.filter((c) => c.status !== 'completed'))
    } catch {
      // non-fatal — badge just won't show
    }
  }

  async function handleToggle() {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      await fetchData()
      setLoading(false)
    }
  }

  const overdueServices = stats
    ? [
        ...stats.overdue_services.map((item) => ({
          key: `equipment-${item.id}`,
          equipmentId: item.id,
          name: item.equipment_name,
          detail: 'Equipment',
          plantName: item.plant_name,
          nextServiceDate: item.next_service_date,
        })),
        ...(stats.overdue_component_services ?? []).map((item) => ({
          key: `component-${item.id}`,
          equipmentId: item.equipment_id,
          name: item.component_name,
          detail: `Component · ${item.equipment_name}`,
          plantName: item.plant_name,
          nextServiceDate: item.next_service_date,
        })),
      ]
    : []
  const dueTodayServices = stats
    ? [
        ...stats.due_today_services.map((item) => ({
          key: `equipment-${item.id}`,
          equipmentId: item.id,
          name: item.equipment_name,
          detail: 'Equipment',
          plantName: item.plant_name,
          nextServiceDate: item.next_service_date,
        })),
        ...(stats.due_today_component_services ?? []).map((item) => ({
          key: `component-${item.id}`,
          equipmentId: item.equipment_id,
          name: item.component_name,
          detail: `Component · ${item.equipment_name}`,
          plantName: item.plant_name,
          nextServiceDate: item.next_service_date,
        })),
      ]
    : []
  const dueSoonServices = stats
    ? [
        ...stats.upcoming_services.map((item) => ({
          key: `equipment-${item.id}`,
          equipmentId: item.id,
          name: item.equipment_name,
          detail: 'Equipment',
          plantName: item.plant_name,
          nextServiceDate: item.next_service_date,
        })),
        ...(stats.upcoming_component_services ?? []).map((item) => ({
          key: `component-${item.id}`,
          equipmentId: item.equipment_id,
          name: item.component_name,
          detail: `Component · ${item.equipment_name}`,
          plantName: item.plant_name,
          nextServiceDate: item.next_service_date,
        })),
      ]
    : []

  const overdueCount  = (stats?.overdue_count ?? 0) + (stats?.overdue_component_count ?? 0)
  const dueTodayCount = (stats?.due_today_count ?? 0) + (stats?.due_today_component_count ?? 0)
  const dueSoonCount  = (stats?.due_soon_count ?? 0) + (stats?.due_soon_component_count ?? 0)
  const openCardCount = activeCards.length
  const totalCount    = overdueCount + dueTodayCount + dueSoonCount + openCardCount

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        title="Notifications"
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-100">

              {/* Overdue services */}
              {overdueCount > 0 && (
                <div>
                  <div className="flex items-center gap-2 bg-purple-50 px-4 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                      Overdue Services ({overdueCount})
                    </span>
                  </div>
                  {overdueCount > 5 ? (
                    <button onClick={() => { setOpen(false); navigate('/service-now') }} className="w-full px-4 py-3 text-left text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors underline underline-offset-2">
                      More than 5 overdue — click here to view all
                    </button>
                  ) : overdueServices.map((item) => (
                    <button key={item.key} onClick={() => goToEquipment(item.equipmentId)} className="w-full px-4 py-2.5 text-left bg-purple-50 hover:bg-purple-100 transition-colors">
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.detail} · {item.plantName ?? '—'} · Due: <span className="text-purple-600">{item.nextServiceDate ?? '—'}</span>
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Due Today */}
              {dueTodayCount > 0 && (
                <div>
                  <div className="flex items-center gap-2 bg-red-50 px-4 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-red-700">
                      Due Today ({dueTodayCount})
                    </span>
                  </div>
                  {dueTodayCount > 5 ? (
                    <button onClick={() => { setOpen(false); navigate('/service-now') }} className="w-full px-4 py-3 text-left text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors underline underline-offset-2">
                      More than 5 due today — click here to view all
                    </button>
                  ) : dueTodayServices.map((item) => (
                    <button key={item.key} onClick={() => goToEquipment(item.equipmentId)} className="w-full px-4 py-2.5 text-left bg-red-50 hover:bg-red-100 transition-colors">
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.detail} · {item.plantName ?? '—'} · Due: <span className="text-red-600">{item.nextServiceDate ?? '—'}</span>
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Due soon */}
              {dueSoonCount > 0 && (
                <div>
                  <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2">
                    <Clock className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
                      Due Soon ({dueSoonCount})
                    </span>
                  </div>
                  {dueSoonCount > 5 ? (
                    <button onClick={() => { setOpen(false); navigate('/service-now') }} className="w-full px-4 py-3 text-left text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition-colors underline underline-offset-2">
                      More than 5 due soon — click here to view all
                    </button>
                  ) : dueSoonServices.map((item) => (
                    <button key={item.key} onClick={() => goToEquipment(item.equipmentId)} className="w-full px-4 py-2.5 text-left bg-yellow-50 hover:bg-yellow-100 transition-colors">
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.detail} · {item.plantName ?? '—'} · Due: <span className="text-yellow-700">{item.nextServiceDate ?? '—'}</span>
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Open job cards */}
              {openCardCount > 0 && (
                <div>
                  <div className="flex items-center gap-2 bg-blue-50 px-4 py-2">
                    <ClipboardList className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Open Job Cards ({openCardCount})
                    </span>
                  </div>
                  {openCardCount > 5 ? (
                    <button onClick={() => { setOpen(false); navigate('/service-now') }} className="w-full px-4 py-3 text-left text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors underline underline-offset-2">
                      More than 5 open job cards — click here to view all
                    </button>
                  ) : activeCards.map((jc) => (
                    <button key={jc.id} onClick={() => goToJobCard(jc)} className="w-full px-4 py-2.5 text-left bg-blue-50 hover:bg-blue-100 transition-colors">
                      <p className="text-sm font-medium text-gray-800">{jc.job_card_number}</p>
                      <p className="text-xs text-gray-500">
                        {jc.component_id ? `${jc.component_name ?? 'Component'} · ${jc.equipment_name ?? '—'}` : jc.equipment_name ?? '—'} · {jc.assigned_artisan ?? 'Unassigned'}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {overdueCount === 0 && dueTodayCount === 0 && dueSoonCount === 0 && openCardCount === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Bell className="h-8 w-8 mb-2 text-gray-300" />
                  <p className="text-sm">All clear — no notifications</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
