import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getDashboardStatsByDateRange, getDowntimeByEquipmentForPlant } from '../services/api'
import type { DashboardStats, DowntimeByEquipment } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'

const COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
]

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`rounded-xl p-3 ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = now.toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(
    defaultFrom
  )
  const [dateTo, setDateTo] = useState(defaultTo)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPlant, setSelectedPlant] = useState<{ id: number; name: string } | null>(null)
  const [equipmentDowntime, setEquipmentDowntime] = useState<DowntimeByEquipment[]>([])
  const [equipmentLoading, setEquipmentLoading] = useState(false)
  const [equipmentError, setEquipmentError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    getDashboardStatsByDateRange(dateFrom || undefined, dateTo || undefined)
      .then((data) => {
        setStats(data)
        if (data.downtime_by_plant.length > 0) {
          setSelectedPlant((current) =>
            current && data.downtime_by_plant.some((p) => p.id === current.id)
              ? current
              : { id: data.downtime_by_plant[0].id, name: data.downtime_by_plant[0].name }
          )
        } else {
          setSelectedPlant(null)
        }
      })
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (!selectedPlant) {
      setEquipmentDowntime([])
      setEquipmentError('')
      return
    }

    setEquipmentLoading(true)
    setEquipmentError('')

    getDowntimeByEquipmentForPlant(selectedPlant.id, dateFrom || undefined, dateTo || undefined)
      .then(setEquipmentDowntime)
      .catch(() => setEquipmentError('Failed to load equipment downtime for selected plant'))
      .finally(() => setEquipmentLoading(false))
  }, [selectedPlant, dateFrom, dateTo])

  function fmtHours(mins: number) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="card text-center text-red-600 py-12">
        {error || 'No data'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Date selector */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          className="input w-40"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          className="input w-40"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            setDateFrom(defaultFrom)
            setDateTo(defaultTo)
          }}
        >
          Reset Dates
        </button>
        <span className="text-sm text-gray-500">
          Showing data for selected date range
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Faults"
          value={stats.total_faults}
          sub={`${stats.open_faults} open · ${stats.in_progress_faults} in progress`}
          icon={TrendingUp}
          color="bg-blue-600"
        />
        <StatCard
          title="Closed Faults"
          value={stats.closed_faults}
          sub={
            stats.total_faults > 0
              ? `${Math.round((stats.closed_faults / stats.total_faults) * 100)}% resolution rate`
              : undefined
          }
          icon={CheckCircle}
          color="bg-green-600"
        />
        <StatCard
          title="Total Downtime"
          value={fmtHours(stats.total_downtime_minutes)}
          sub={`${stats.total_downtime_minutes} minutes total`}
          icon={Clock}
          color="bg-orange-500"
        />
        <StatCard
          title="Avg Repair Time"
          value={fmtHours(Math.round(stats.avg_repair_time_minutes))}
          sub="MTTR"
          icon={Wrench}
          color="bg-purple-600"
        />
      </div>

      {/* Row 1 charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Faults by day */}
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Fault Trend (faults per day)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={stats.faults_by_day}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(new Date(v), 'd MMM')}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(v: number, name: string) => {
                  const series = String(name || '').toLowerCase()
                  if (series.includes('downtime')) {
                    return [`${v} min`, 'Downtime']
                  }
                  return [v, 'Faults']
                }}
                labelFormatter={(l) => format(new Date(l), 'd MMM yyyy')}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                name="Faults"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="downtime"
                name="Downtime (min)"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Downtime by plant */}
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Downtime by Plant (minutes)</h2>
          <p className="mb-4 text-xs text-gray-500">Click a plant bar to view downtime by equipment in that plant.</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.downtime_by_plant} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip
                formatter={(v: number) => [`${v} min`, 'Downtime']}
              />
              <Bar dataKey="total_downtime" name="Downtime" radius={[0, 4, 4, 0]}>
                {stats.downtime_by_plant.map((plant, i) => (
                  <Cell
                    key={plant.id}
                    fill={COLORS[i % COLORS.length]}
                    cursor="pointer"
                    onClick={() => {
                      if (selectedPlant?.id === plant.id) {
                        setSelectedPlant(null)
                      } else {
                        setSelectedPlant({ id: plant.id, name: plant.name })
                      }
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mb-1 text-sm font-semibold text-gray-700">
              {selectedPlant ? `Downtime by Equipment — ${selectedPlant.name}` : 'Downtime by Equipment'}
            </h2>
            <p className="text-xs text-gray-500">
              {selectedPlant
                ? 'Showing equipment downtime for the selected plant.'
                : 'Select a plant from the chart above to drill into its equipment downtime.'}
            </p>
          </div>
          {selectedPlant && (
            <button
              type="button"
              className="btn-secondary btn-xs"
              onClick={() => setSelectedPlant(null)}
            >
              Clear selection
            </button>
          )}
        </div>

        {equipmentLoading ? (
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : equipmentError ? (
          <div className="flex h-64 items-center justify-center text-red-600">
            {equipmentError}
          </div>
        ) : selectedPlant ? (
          equipmentDowntime.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={equipmentDowntime} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={140}
                  tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 22) + '…' : v)}
                />
                <Tooltip
                  formatter={(value: number, name: string, props: any) => {
                    const data = props.payload
                    return [
                      `${value} min`,
                      `Downtime (${data.fault_count} faults)`
                    ]
                  }}
                />
                <Bar dataKey="total_downtime" name="Downtime" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-64 items-center justify-center text-gray-500">
              No equipment downtime found for this plant in the selected date range.
            </div>
          )
        ) : (
          <div className="flex h-64 items-center justify-center text-gray-500">
            Click a plant bar to drill into downtime by equipment.
          </div>
        )}
      </div>

      {/* Row 2 charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Top equipment */}
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Top 10 Equipment by Faults</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.top_equipment} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10 }}
                width={130}
                tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 18) + '…' : v)}
              />
              <Tooltip />
              <Bar dataKey="fault_count" name="Faults" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top artisans */}
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Top Artisans by Jobs</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.top_artisans}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + '…' : v)}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="job_count" name="Jobs" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}
