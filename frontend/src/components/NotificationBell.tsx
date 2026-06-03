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

  const overdueCount  = stats?.overdue_count  ?? 0
  const dueSoonCount  = stats?.due_soon_count  ?? 0
  const openCardCount = activeCards.length
  const totalCount    = overdueCount + dueSoonCount + openCardCount

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
                  <div className="flex items-center gap-2 bg-red-50 px-4 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-red-700">
                      Overdue Services ({overdueCount})
                    </span>
                  </div>
                  {(stats!.overdue_services ?? []).slice(0, 5).map((item) => (
                    <button key={item.id} onClick={() => goToEquipment(item.id)} className="w-full px-4 py-2.5 text-left hover:bg-red-50 transition-colors">
                      <p className="text-sm font-medium text-gray-800">{item.equipment_name}</p>
                      <p className="text-xs text-gray-500">
                        {item.plant_name ?? '—'} · Due: <span className="text-red-600">{item.next_service_date ?? '—'}</span>
                      </p>
                    </button>
                  ))}
                  {overdueCount > 5 && (
                    <p className="px-4 py-1.5 text-xs font-medium text-red-600">
                      +{overdueCount - 5} more overdue
                    </p>
                  )}
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
                  {(stats!.upcoming_services ?? []).slice(0, 5).map((item) => (
                    <button key={item.id} onClick={() => goToEquipment(item.id)} className="w-full px-4 py-2.5 text-left hover:bg-yellow-50 transition-colors">
                      <p className="text-sm font-medium text-gray-800">{item.equipment_name}</p>
                      <p className="text-xs text-gray-500">
                        {item.plant_name ?? '—'} · Due: <span className="text-yellow-700">{item.next_service_date ?? '—'}</span>
                      </p>
                    </button>
                  ))}
                  {dueSoonCount > 5 && (
                    <p className="px-4 py-1.5 text-xs font-medium text-yellow-700">
                      +{dueSoonCount - 5} more due soon
                    </p>
                  )}
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
                  {activeCards.slice(0, 5).map((jc) => (
                    <button key={jc.id} onClick={() => goToJobCard(jc)} className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors">
                      <p className="text-sm font-medium text-gray-800">{jc.job_card_number}</p>
                      <p className="text-xs text-gray-500">
                        {jc.equipment_name ?? '—'} · {jc.assigned_artisan ?? 'Unassigned'}
                      </p>
                    </button>
                  ))}
                  {openCardCount > 5 && (
                    <p className="px-4 py-1.5 text-xs font-medium text-blue-600">
                      +{openCardCount - 5} more open
                    </p>
                  )}
                </div>
              )}

              {/* Empty state */}
              {overdueCount === 0 && dueSoonCount === 0 && openCardCount === 0 && (
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
