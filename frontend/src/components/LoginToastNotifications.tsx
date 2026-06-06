import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ClipboardList, Clock, X } from 'lucide-react'
import { getJobCards, getServiceDashboardStats } from '../services/api'

const SESSION_KEY = 'login_toasts_shown'
const AUTO_DISMISS_BASE_MS = 6000
const AUTO_DISMISS_STAGGER_MS = 500
const EXIT_DURATION_MS = 300

type ToastType = 'overdue' | 'due-today' | 'due-soon' | 'job-cards'

interface ToastItem {
  id: ToastType
  message: string
  exiting: boolean
}

const TOAST_STYLES: Record<
  ToastType,
  { wrapClass: string; Icon: React.ElementType; iconClass: string; msgClass: string }
> = {
  'overdue': {
    wrapClass: 'border-l-4 border-l-purple-500 bg-purple-50',
    Icon: AlertTriangle,
    iconClass: 'text-purple-600',
    msgClass: 'text-purple-900',
  },
  'due-today': {
    wrapClass: 'border-l-4 border-l-red-500 bg-red-50',
    Icon: AlertTriangle,
    iconClass: 'text-red-600',
    msgClass: 'text-red-900',
  },
  'due-soon': {
    wrapClass: 'border-l-4 border-l-yellow-500 bg-yellow-50',
    Icon: Clock,
    iconClass: 'text-yellow-600',
    msgClass: 'text-yellow-900',
  },
  'job-cards': {
    wrapClass: 'border-l-4 border-l-blue-500 bg-blue-50',
    Icon: ClipboardList,
    iconClass: 'text-blue-600',
    msgClass: 'text-blue-900',
  },
}

function plural(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural
}

interface ToastCardProps {
  toast: ToastItem
  onDismiss: () => void
  onNavigate: () => void
}

function ToastCard({ toast, onDismiss, onNavigate }: ToastCardProps) {
  const { wrapClass, Icon, iconClass, msgClass } = TOAST_STYLES[toast.id]
  return (
    <div
      className={[
        'pointer-events-auto w-80 rounded-lg shadow-lg border border-gray-200 overflow-hidden',
        'transition-all duration-300',
        toast.exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0',
        wrapClass,
      ].join(' ')}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
        <button
          className={`flex-1 text-left text-sm font-medium ${msgClass} hover:underline underline-offset-2`}
          onClick={onNavigate}
        >
          {toast.message}
        </button>
        <button
          onClick={onDismiss}
          className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function LoginToastNotifications() {
  const navigate = useNavigate()
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return

    let cancelled = false

    async function fetchAndShow() {
      try {
        const [stats, jobCardsRes] = await Promise.all([
          getServiceDashboardStats(),
          getJobCards({ limit: 100 }),
        ])

        if (cancelled) return

        const critHighCards = jobCardsRes.job_cards.filter(
          (c) => c.status !== 'completed' && (c.priority === 'critical' || c.priority === 'high')
        )

        const items: Omit<ToastItem, 'exiting'>[] = []

        if (stats.overdue_count > 0) {
          items.push({
            id: 'overdue',
            message: `${stats.overdue_count} ${plural(stats.overdue_count, 'service is', 'services are')} overdue`,
          })
        }
        if (stats.due_today_count > 0) {
          items.push({
            id: 'due-today',
            message: `${stats.due_today_count} ${plural(stats.due_today_count, 'service is', 'services are')} due today`,
          })
        }
        if (stats.due_soon_count > 0) {
          items.push({
            id: 'due-soon',
            message: `${stats.due_soon_count} ${plural(stats.due_soon_count, 'service is', 'services are')} due within the next 14 days`,
          })
        }
        if (critHighCards.length > 0) {
          items.push({
            id: 'job-cards',
            message: `${critHighCards.length} high priority job ${plural(critHighCards.length, 'card is', 'cards are')} still open`,
          })
        }

        // Always mark shown so we never re-fetch on refresh
        sessionStorage.setItem(SESSION_KEY, '1')

        if (items.length === 0) return

        setToasts(items.map((item) => ({ ...item, exiting: false })))

        // Schedule auto-dismiss with stagger so they don't all vanish at once
        items.forEach((item, index) => {
          setTimeout(() => {
            beginDismiss(item.id)
          }, AUTO_DISMISS_BASE_MS + index * AUTO_DISMISS_STAGGER_MS)
        })
      } catch {
        // non-fatal — toasts just won't appear
      }
    }

    fetchAndShow()
    return () => {
      cancelled = true
    }
  }, [])

  function beginDismiss(id: ToastType) {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    )
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, EXIT_DURATION_MS)
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 items-end pointer-events-none">
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={() => beginDismiss(toast.id)}
          onNavigate={() => {
            beginDismiss(toast.id)
            navigate('/service-now')
          }}
        />
      ))}
    </div>
  )
}
