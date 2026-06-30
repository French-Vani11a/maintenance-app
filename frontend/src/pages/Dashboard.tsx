import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  TrendingUp,
  Wrench,
  X,
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
import { getDashboardStatsByDateRange, getDowntimeByEquipmentForPlant, getEquipmentFaultsByGroup, getRecords } from '../services/api'
import type { DashboardStats, DowntimeByEquipment, MaintenanceRecord } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import LoginToastNotifications from '../components/LoginToastNotifications'

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

const RECORDS_PAGE_SIZE = 10

export default function Dashboard() {
  const navigate = useNavigate()
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
  const topDowntimePlants = (stats?.downtime_by_plant ?? []).slice(0, 10)

  const [selectedGroup, setSelectedGroup] = useState<{ id: number; name: string } | null>(null)
  const [groupEquipmentFaults, setGroupEquipmentFaults] = useState<Array<{ id: number; name: string; fault_count: number; total_downtime: number }>>([])
  const [groupEquipmentLoading, setGroupEquipmentLoading] = useState(false)
  const [groupEquipmentError, setGroupEquipmentError] = useState('')

  // Equipment records modal
  const [equipModal, setEquipModal] = useState<{ id: number; name: string } | null>(null)
  const [equipRecords, setEquipRecords] = useState<MaintenanceRecord[]>([])
  const [equipRecordsTotal, setEquipRecordsTotal] = useState(0)
  const [equipRecordsPage, setEquipRecordsPage] = useState(0)
  const [equipRecordsLoading, setEquipRecordsLoading] = useState(false)
  const [equipRecordsError, setEquipRecordsError] = useState('')
  const [pdfDownloading, setPdfDownloading] = useState(false)

  // Artisan records modal
  const [artisanModal, setArtisanModal] = useState<string | null>(null)
  const [artisanRecords, setArtisanRecords] = useState<MaintenanceRecord[]>([])
  const [artisanRecordsTotal, setArtisanRecordsTotal] = useState(0)
  const [artisanRecordsPage, setArtisanRecordsPage] = useState(0)
  const [artisanRecordsLoading, setArtisanRecordsLoading] = useState(false)
  const [artisanRecordsError, setArtisanRecordsError] = useState('')
  const [artisanPdfDownloading, setArtisanPdfDownloading] = useState(false)

  async function downloadArtisanRecordsPdf() {
    if (!artisanModal) return
    setArtisanPdfDownloading(true)
    try {
      const allRes = await getRecords({ artisan_name: artisanModal, skip: 0, limit: 1000 })

      const logoRes = await fetch('/logo-new.png')
      const logoBlob = await logoRes.blob()
      const logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(logoBlob)
      })

      const doc = new jsPDF()

      doc.addImage(logoBase64, 'PNG', 14, 10, 60, 22)

      doc.setFontSize(13)
      doc.setTextColor(40)
      doc.text(`Maintenance Records — ${artisanModal}`, 14, 42)

      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(`Generated: ${format(new Date(), 'd MMM yyyy')}  ·  Total records: ${allRes.total}`, 14, 49)

      autoTable(doc, {
        startY: 55,
        head: [['Date', 'MR No.', 'Issue Description', 'Equipment', 'Downtime', 'Status']],
        body: allRes.records.map((r) => [
          r.record_date,
          r.mr_no || '—',
          r.issue_description || '—',
          r.equipment_name || '—',
          r.downtime_minutes > 0 ? `${r.downtime_minutes} min` : '—',
          r.status,
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 253, 244] },
      })

      doc.save(`${artisanModal} - Maintenance Records.pdf`)
    } catch {
      // silently fail
    } finally {
      setArtisanPdfDownloading(false)
    }
  }

  async function downloadEquipRecordsPdf() {
    if (!equipModal) return
    setPdfDownloading(true)
    try {
      const allRes = await getRecords({ equipment_id: equipModal.id, skip: 0, limit: 1000 })

      const logoRes = await fetch('/logo-new.png')
      const logoBlob = await logoRes.blob()
      const logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(logoBlob)
      })

      const doc = new jsPDF()

      // Logo — 832x300 ratio ≈ 2.77:1, render at 60x22mm
      doc.addImage(logoBase64, 'PNG', 14, 10, 60, 22)

      doc.setFontSize(13)
      doc.setTextColor(40)
      doc.text(`Maintenance Records — ${equipModal.name}`, 14, 42)

      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(`Generated: ${format(new Date(), 'd MMM yyyy')}  ·  Total records: ${allRes.total}`, 14, 49)

      autoTable(doc, {
        startY: 55,
        head: [['Date', 'MR No.', 'Issue Description', 'Artisan', 'Downtime', 'Status']],
        body: allRes.records.map((r) => [
          r.record_date,
          r.mr_no || '—',
          r.issue_description || '—',
          r.artisan_name || '—',
          r.downtime_minutes > 0 ? `${r.downtime_minutes} min` : '—',
          r.status,
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [0, 180, 80], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 255, 250] },
      })

      doc.save(`${equipModal.name} - Maintenance Records.pdf`)
    } catch {
      // silently fail — user still has the table on screen
    } finally {
      setPdfDownloading(false)
    }
  }

  useEffect(() => {
    if (!equipModal) { setEquipRecords([]); setEquipRecordsTotal(0); return }
    setEquipRecordsLoading(true)
    setEquipRecordsError('')
    getRecords({ equipment_id: equipModal.id, skip: equipRecordsPage * RECORDS_PAGE_SIZE, limit: RECORDS_PAGE_SIZE })
      .then((res) => { setEquipRecords(res.records); setEquipRecordsTotal(res.total) })
      .catch(() => setEquipRecordsError('Failed to load records'))
      .finally(() => setEquipRecordsLoading(false))
  }, [equipModal, equipRecordsPage])

  useEffect(() => {
    if (!artisanModal) { setArtisanRecords([]); setArtisanRecordsTotal(0); return }
    setArtisanRecordsLoading(true)
    setArtisanRecordsError('')
    getRecords({ artisan_name: artisanModal, skip: artisanRecordsPage * RECORDS_PAGE_SIZE, limit: RECORDS_PAGE_SIZE })
      .then((res) => { setArtisanRecords(res.records); setArtisanRecordsTotal(res.total) })
      .catch(() => setArtisanRecordsError('Failed to load records'))
      .finally(() => setArtisanRecordsLoading(false))
  }, [artisanModal, artisanRecordsPage])

  useEffect(() => {
    setLoading(true)
    setError('')
    getDashboardStatsByDateRange(dateFrom || undefined, dateTo || undefined)
      .then((data) => {
        setStats(data)
        const topPlants = data.downtime_by_plant.slice(0, 10)
        if (topPlants.length > 0) {
          setSelectedPlant((current) =>
            current && topPlants.some((p) => p.id === current.id)
              ? current
              : { id: topPlants[0].id, name: topPlants[0].name }
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

  useEffect(() => {
    if (!selectedGroup) { setGroupEquipmentFaults([]); setGroupEquipmentError(''); return }
    setGroupEquipmentLoading(true)
    setGroupEquipmentError('')
    getEquipmentFaultsByGroup(selectedGroup.id, dateFrom || undefined, dateTo || undefined)
      .then(setGroupEquipmentFaults)
      .catch(() => setGroupEquipmentError('Failed to load equipment faults for selected group'))
      .finally(() => setGroupEquipmentLoading(false))
  }, [selectedGroup, dateFrom, dateTo])

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
      <LoginToastNotifications />
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
          <ResponsiveContainer width="100%" height={Math.max(280, topDowntimePlants.length * 36)}>
            <BarChart data={topDowntimePlants} layout="vertical" margin={{ top: 4, right: 20, left: 24, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={170}
                tickFormatter={(v: string) => (v.length > 26 ? v.slice(0, 26) + '…' : v)}
              />
              <Tooltip
                formatter={(v: number) => [`${v} min`, 'Downtime']}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="total_downtime" name="Downtime" radius={[0, 4, 4, 0]}>
                {topDowntimePlants.map((plant, i) => (
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
            <>
              <p className="mb-3 text-xs text-gray-500">Click an equipment bar to view its maintenance records.</p>
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
                  <Bar dataKey="total_downtime" name="Downtime" radius={[0, 4, 4, 0]}>
                    {equipmentDowntime.map((eq, i) => (
                      <Cell
                        key={eq.id ?? i}
                        fill="#10b981"
                        cursor="pointer"
                        onClick={() => { setEquipModal({ id: eq.id, name: eq.name }); setEquipRecordsPage(0) }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
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
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Top 10 Equipment by Faults</h2>
          <p className="mb-3 text-xs text-gray-500">Click a bar to view its maintenance records.</p>
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
              <Bar dataKey="fault_count" name="Faults" radius={[0, 4, 4, 0]}>
                {stats.top_equipment.map((eq) => (
                  <Cell
                    key={eq.id}
                    fill="#6366f1"
                    cursor="pointer"
                    onClick={() => { setEquipModal({ id: eq.id, name: eq.name }); setEquipRecordsPage(0) }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top artisans */}
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Top Artisans by Jobs</h2>
          <p className="mb-3 text-xs text-gray-500">Click a bar to view their maintenance records.</p>
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
              <Bar dataKey="job_count" name="Jobs" radius={[4, 4, 0, 0]}>
                {stats.top_artisans.map((a) => (
                  <Cell
                    key={a.name}
                    fill="#22c55e"
                    cursor="pointer"
                    onClick={() => { setArtisanModal(a.name); setArtisanRecordsPage(0) }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Equipment Group Faults</h2>
        <p className="mb-3 text-xs text-gray-500">Click a bar to see top 10 equipment faults for that group.</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats.equipment_group_faults} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10 }}
              width={200}
              tickFormatter={(v: string) => (v.length > 24 ? v.slice(0, 24) + '…' : v)}
            />
            <Tooltip />
            <Bar dataKey="fault_count" name="Faults" radius={[0, 4, 4, 0]}>
              {stats.equipment_group_faults.map((g) => (
                <Cell
                  key={g.id}
                  fill={selectedGroup?.id === g.id ? '#d97706' : '#f59e0b'}
                  cursor="pointer"
                  onClick={() => {
                    if (selectedGroup?.id === g.id) {
                      setSelectedGroup(null)
                    } else {
                      setSelectedGroup({ id: g.id, name: g.name })
                    }
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Group equipment faults drill-down */}
      <div className="card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mb-1 text-sm font-semibold text-gray-700">
              {selectedGroup ? `Top Equipment Faults — ${selectedGroup.name}` : 'Top Equipment Faults by Group'}
            </h2>
            <p className="text-xs text-gray-500">
              {selectedGroup
                ? 'Showing top 10 equipment by fault count for the selected group.'
                : 'Select a group from the chart above to drill into its equipment faults.'}
            </p>
          </div>
          {selectedGroup && (
            <button
              type="button"
              className="btn-secondary btn-xs"
              onClick={() => setSelectedGroup(null)}
            >
              Clear selection
            </button>
          )}
        </div>

        {groupEquipmentError ? (
          <div className="flex h-64 items-center justify-center text-red-600">
            {groupEquipmentError}
          </div>
        ) : selectedGroup ? (
          groupEquipmentLoading ? (
            <div className="flex h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
          ) : groupEquipmentFaults.length > 0 ? (
            <>
              <p className="mb-3 text-xs text-gray-500">Click an equipment bar to view its maintenance records.</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={groupEquipmentFaults} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    width={160}
                    tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 20) + '…' : v)}
                  />
                  <Tooltip />
                  <Bar dataKey="fault_count" name="Faults" radius={[0, 4, 4, 0]}>
                    {groupEquipmentFaults.map((eq, i) => (
                      <Cell
                        key={eq.id}
                        fill={COLORS[i % COLORS.length]}
                        cursor="pointer"
                        onClick={() => { setEquipModal({ id: eq.id, name: eq.name }); setEquipRecordsPage(0) }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="flex h-64 items-center justify-center text-gray-500">
              No equipment faults found for this group in the selected date range.
            </div>
          )
        ) : (
          <div className="flex h-64 items-center justify-center text-gray-500">
            Click a group bar to drill into its equipment faults.
          </div>
        )}
      </div>

      {/* ── Equipment Records Modal ─────────────────────────────────────── */}
      {equipModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => setEquipModal(null)}
        >
          <div className="card w-full max-w-4xl my-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{equipModal.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Maintenance records — click a row to open it</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadEquipRecordsPdf}
                  disabled={pdfDownloading || equipRecordsLoading}
                  className="btn-primary btn-sm flex items-center gap-1.5"
                >
                  {pdfDownloading ? <LoadingSpinner size="sm" /> : <Download className="h-3.5 w-3.5" />}
                  {pdfDownloading ? 'Generating…' : 'Download PDF'}
                </button>
                <button
                  onClick={() => setEquipModal(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {equipRecordsLoading ? (
              <div className="flex h-40 items-center justify-center"><LoadingSpinner size="lg" /></div>
            ) : equipRecordsError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{equipRecordsError}</div>
            ) : equipRecords.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No maintenance records found for this equipment.</p>
            ) : (
              <>
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
                      {equipRecords.map((r) => (
                        <tr
                          key={r.id}
                          className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                          onClick={() => {
                            setEquipModal(null)
                            navigate('/records', { state: { openRecordId: r.id } })
                          }}
                        >
                          <td className="text-gray-600">{r.record_date}</td>
                          <td className="font-mono text-xs text-gray-500">{r.mr_no || '—'}</td>
                          <td className="max-w-[240px] truncate">{r.issue_description || '—'}</td>
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

                {equipRecordsTotal > RECORDS_PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm text-gray-500">
                      Showing {equipRecordsPage * RECORDS_PAGE_SIZE + 1}–{Math.min((equipRecordsPage + 1) * RECORDS_PAGE_SIZE, equipRecordsTotal)} of {equipRecordsTotal}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => setEquipRecordsPage((p) => Math.max(0, p - 1))}
                        disabled={equipRecordsPage === 0}
                      >
                        <ChevronLeft className="h-4 w-4" /> Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {equipRecordsPage + 1} of {Math.ceil(equipRecordsTotal / RECORDS_PAGE_SIZE)}
                      </span>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => setEquipRecordsPage((p) => p + 1)}
                        disabled={(equipRecordsPage + 1) * RECORDS_PAGE_SIZE >= equipRecordsTotal}
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Artisan Records Modal ───────────────────────────────────────── */}
      {artisanModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => setArtisanModal(null)}
        >
          <div className="card w-full max-w-4xl my-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{artisanModal}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Maintenance records — click a row to open it</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadArtisanRecordsPdf}
                  disabled={artisanPdfDownloading || artisanRecordsLoading}
                  className="btn-primary btn-sm flex items-center gap-1.5"
                >
                  {artisanPdfDownloading ? <LoadingSpinner size="sm" /> : <Download className="h-3.5 w-3.5" />}
                  {artisanPdfDownloading ? 'Generating…' : 'Download PDF'}
                </button>
                <button
                  onClick={() => setArtisanModal(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {artisanRecordsLoading ? (
              <div className="flex h-40 items-center justify-center"><LoadingSpinner size="lg" /></div>
            ) : artisanRecordsError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{artisanRecordsError}</div>
            ) : artisanRecords.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No maintenance records found for this artisan.</p>
            ) : (
              <>
                <div className="table-container">
                  <table className="table text-sm">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>MR No.</th>
                        <th>Issue</th>
                        <th>Equipment</th>
                        <th>Downtime</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {artisanRecords.map((r) => (
                        <tr
                          key={r.id}
                          className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                          onClick={() => {
                            setArtisanModal(null)
                            navigate('/records', { state: { openRecordId: r.id } })
                          }}
                        >
                          <td className="text-gray-600">{r.record_date}</td>
                          <td className="font-mono text-xs text-gray-500">{r.mr_no || '—'}</td>
                          <td className="max-w-[240px] truncate">{r.issue_description || '—'}</td>
                          <td className="text-gray-600">{r.equipment_name || '—'}</td>
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

                {artisanRecordsTotal > RECORDS_PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm text-gray-500">
                      Showing {artisanRecordsPage * RECORDS_PAGE_SIZE + 1}–{Math.min((artisanRecordsPage + 1) * RECORDS_PAGE_SIZE, artisanRecordsTotal)} of {artisanRecordsTotal}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => setArtisanRecordsPage((p) => Math.max(0, p - 1))}
                        disabled={artisanRecordsPage === 0}
                      >
                        <ChevronLeft className="h-4 w-4" /> Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {artisanRecordsPage + 1} of {Math.ceil(artisanRecordsTotal / RECORDS_PAGE_SIZE)}
                      </span>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => setArtisanRecordsPage((p) => p + 1)}
                        disabled={(artisanRecordsPage + 1) * RECORDS_PAGE_SIZE >= artisanRecordsTotal}
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
