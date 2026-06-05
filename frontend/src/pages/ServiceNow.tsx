import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  History,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  completeJobCard,
  createJobCard,
  deleteJobCard,
  exportServiceHistoryCsv,
  getDueEquipment,
  getEnrichedServiceHistory,
  getEquipment,
  getEquipmentGroups,
  getJobCard,
  getJobCards,
  getPlants,
  getServiceHistoryRecord,
  updateJobCard,
} from '../services/api'
import type {
  DueEquipment,
  EnrichedServiceHistory,
  Equipment,
  EquipmentGroup,
  Plant,
  ServiceJobCard,
} from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import ListInput, { parseListField, serializeListField } from '../components/ListInput'

// ── Print helper ──────────────────────────────────────────────────────────────

function printJobCard(card: ServiceJobCard) {
  const logoUrl = `${window.location.origin}/jblogo.jpg`
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const generatedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

  const workList = parseListField(card.work_to_be_done)
  const partsList = parseListField(card.parts_required)

  const priorityColor: Record<string, string> = {
    critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a',
  }
  const pColor = priorityColor[card.priority] ?? '#6b7280'

  const CB = '&#9744;'

  const blankWorkRows = [1, 2, 3].map(n =>
    `<tr><td class="nc">${n}</td><td class="td">&nbsp;</td><td class="cc">${CB}</td></tr>`
  ).join('')

  const workRows = workList.length > 0
    ? workList.map((item, i) =>
        `<tr><td class="nc">${i + 1}</td><td class="td">${item}</td><td class="cc">${CB}</td></tr>`
      ).join('')
    : blankWorkRows

  const blankPartsRows = [1, 2, 3].map(() =>
    `<tr><td class="td">&nbsp;</td><td class="cc">${CB}</td></tr>`
  ).join('')

  const partsRows = partsList.length > 0
    ? partsList.map(item =>
        `<tr><td class="td">${item}</td><td class="cc">${CB}</td></tr>`
      ).join('')
    : blankPartsRows

  const statusLabel = card.status === 'open' ? 'Open / Assigned'
    : card.status === 'in-progress' ? 'In Progress'
    : card.status === 'completed' ? 'Completed'
    : card.status ?? '—'

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Job Card ${card.job_card_number}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a1a;background:#fff;padding:18mm 16mm 20mm}
@page{size:A4 portrait;margin:12mm 14mm 16mm}
@media print{body{padding:0}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}

/* Header */
.hdr{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2.5px solid #1e293b;padding-bottom:14px;margin-bottom:18px;gap:16px}
.hdr-logo{height:60px;width:auto;object-fit:contain;flex-shrink:0}
.hdr-center{flex:1;display:flex;flex-direction:column;justify-content:center}
.hdr-sub{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px}
.barcode{font-family:'Courier New',monospace;font-size:28px;letter-spacing:-3px;color:#1e293b;line-height:1}
.hdr-right{text-align:right;flex-shrink:0;min-width:175px}
.jc-num{font-size:20px;font-weight:900;color:#ea580c;letter-spacing:0.5px}
.gen-date{font-size:10px;color:#64748b;margin-top:5px}
.gen-by{font-size:10px;color:#94a3b8;margin-top:2px}

/* Section headers */
.sh{background:#1e293b;color:#fff;padding:6px 10px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:18px}
.sh2{background:#374151;color:#fff;padding:6px 10px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:18px}

/* General info table */
.it{width:100%;border-collapse:collapse}
.it td{border:1px solid #cbd5e1;padding:7px 10px;font-size:11px;vertical-align:middle}
.lbl{background:#f1f5f9;color:#374151;font-weight:700;width:20%;white-space:nowrap}
.val{color:#1a1a1a}
.pval{font-weight:700;color:${pColor}}

/* Safety */
.safety{border:2px solid #ea580c;border-radius:3px;background:#fff7ed;padding:11px 14px;margin-top:16px}
.safehdr{color:#c2410c;font-weight:700;font-size:11.5px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:9px}
.saferow{font-size:11px;padding:4px 0 4px 10px;border-left:3px solid #fb923c;margin-bottom:5px;color:#1a1a1a}
.saferow b{color:#9a3412}

/* Description box */
.dbox{border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;min-height:34px;background:#fafafa;font-style:italic;color:#374151}

/* Checklist table */
.ct{width:100%;border-collapse:collapse}
.ct thead tr{background:#334155}
.ct thead th{color:#fff;padding:6px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;text-align:left;border:1px solid #475569}
.ct thead th.cth{text-align:center;width:56px}
.ct tbody tr:nth-child(even){background:#f8fafc}
.nc{text-align:center;border:1px solid #d1d5db;padding:7px 5px;font-size:11px;width:34px;color:#64748b;font-weight:600}
.td{border:1px solid #d1d5db;padding:7px 10px;font-size:11px;min-height:28px}
.cc{text-align:center;border:1px solid #d1d5db;padding:4px;font-size:19px;width:56px;color:#374151;border-left:2px solid #94a3b8}

/* Completion */
.compbox{border:1px solid #cbd5e1;padding:14px 16px}
.trow{display:flex;gap:28px;margin-bottom:20px}
.tf{flex:1}
.tlbl{font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:20px;letter-spacing:0.4px}
.tline{border-bottom:1px solid #1e293b}
.obslbl{font-size:11px;font-weight:700;color:#374151;margin-bottom:7px}
.obsbox{border:1px dashed #cbd5e1;min-height:72px;padding:6px;font-size:11px;color:#cbd5e1}

/* Sign-off */
.sog{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}
.sob{border:1px solid #cbd5e1;padding:12px 14px}
.sorole{font-size:11px;font-weight:700;color:#1e293b;margin-bottom:22px}
.soline{border-bottom:1px solid #374151;margin-top:2px;margin-bottom:2px}
.solabel{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px}
.sorow{margin-top:18px}

/* Footer */
.footer{border-top:1.5px solid #1e293b;margin-top:22px;padding-top:8px;text-align:center;font-size:9.5px;color:#94a3b8}
</style>
</head>
<body>

<!-- HEADER -->
<div class="hdr">
  <img src="${logoUrl}" alt="Logo" class="hdr-logo" onerror="this.style.display='none'"/>
  <div class="hdr-center">
    <div class="hdr-sub">Job Card</div>
    <div class="barcode">|||| ||||| ||||| |||| ||||</div>
  </div>
  <div class="hdr-right">
    <div class="jc-num">${card.job_card_number}</div>
    <div class="gen-date">Generated: ${generatedDate}</div>
    <div class="gen-by">By: ${card.created_by_user_name ?? '—'}</div>
  </div>
</div>

<!-- 1. GENERAL INFORMATION -->
<div class="sh">1. General Information</div>
<table class="it">
  <tr>
    <td class="lbl">Work Type / Service Type</td>
    <td class="val">${card.service_type ?? '—'}</td>
    <td class="lbl">Priority</td>
    <td class="val pval">${card.priority.toUpperCase()}</td>
  </tr>
  <tr>
    <td class="lbl">Equipment / Asset</td>
    <td class="val" colspan="3">${card.equipment_name ?? '—'}${card.equipment_code ? ' <span style="color:#64748b;font-size:10px">('+card.equipment_code+')</span>' : ''}</td>
  </tr>
  <tr>
    <td class="lbl">Plant / Location</td>
    <td class="val">${card.plant_name ?? '—'}</td>
    <td class="lbl">Status</td>
    <td class="val">${statusLabel}</td>
  </tr>
  <tr>
    <td class="lbl">Start Date</td>
    <td class="val">${card.start_date ?? '—'}</td>
    <td class="lbl">Due Date</td>
    <td class="val">${card.due_date ?? '—'}</td>
  </tr>
  <tr>
    <td class="lbl">Issued By / Created By</td>
    <td class="val">${card.assigned_by ?? card.created_by_user_name ?? '—'}</td>
    <td class="lbl">Assigned To / Artisan</td>
    <td class="val">${card.assigned_artisan ?? '—'}</td>
  </tr>
</table>

<!-- SAFETY -->
<div class="safety">
  <div class="safehdr">&#9888;&nbsp; Safety &amp; Compliance Requirements</div>
  <div class="saferow"><b>Hazards:</b> Mechanical entrapment, electrical hazards. Refer to site hazard register before commencing work.</div>
  <div class="saferow"><b>PPE Required:</b> Safety boots, high-visibility vest, safety glasses, hearing protection, appropriate gloves.</div>
  <div class="saferow"><b>LOTO (Lockout / Tagout):</b> Isolate all energy sources and secure with personalized padlocks before commencing work. Confirm with supervisor.</div>
</div>

${card.service_description ? `
<div class="sh" style="margin-top:16px">Service Description</div>
<div class="dbox">${card.service_description}</div>` : ''}

<!-- 2. WORK TO BE DONE -->
<div class="sh">2. Work To Be Done</div>
<table class="ct">
  <thead>
    
  </thead>
  <tbody>${workRows}</tbody>
</table>

<!-- 3. PARTS REQUIRED -->
<div class="sh">3. Parts Required</div>
<table class="ct">
  <thead>
    
  </thead>
  <tbody>${partsRows}</tbody>
</table>

${card.notes ? `
<div class="sh" style="margin-top:16px">Notes</div>
<div class="dbox">${card.notes}</div>` : ''}

<!-- 4. LABOR & COMPLETION RECORD -->
<div class="sh2">4. Labor &amp; Completion Record</div>
<div class="compbox">
  <div class="trow">
    <div class="tf"><div class="tlbl">Start Time</div><div class="tline"></div></div>
    <div class="tf"><div class="tlbl">End Time</div><div class="tline"></div></div>
    <div class="tf"><div class="tlbl">Total Hours</div><div class="tline"></div></div>
  </div>
  <div class="obslbl">Root Cause / Observations (if corrective action was needed):</div>
  <div class="obsbox"></div>

  <div class="sog">
    <div class="sob">
      <div class="sorole">Maintenance Sign-Off (Technician)</div>
      <div class="sorow"><div class="soline"></div><div class="solabel">Signature</div></div>
      <div class="sorow"><div class="soline" style="width:55%"></div><div class="solabel">Date</div></div>
    </div>
    <div class="sob">
      <div class="sorole">Approval Sign-Off (Supervisor / PM Officer)</div>
      <div class="sorow"><div class="soline"></div><div class="solabel">Signature</div></div>
      <div class="sorow"><div class="soline" style="width:55%"></div><div class="solabel">Date</div></div>
    </div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer">Proton Bakers CMMS System &bull; Service Job Card &bull; Keep this document for compliance records.</div>

</body>
</html>`
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'width=900,height=700')
  if (win) {
    win.onload = () => {
      win.print()
      URL.revokeObjectURL(url)
    }
  }
}

// ── Empty form constants ──────────────────────────────────────────────────────

const EMPTY_JC_FORM = {
  equipment_id: null as number | null,
  plant_id: null as number | null,
  service_type: '',
  start_date: '',
  due_date: '',
  _next_service_date: '', // display hint only — not sent to API
  service_description: '',
  work_to_be_done: [] as string[],
  assigned_artisan: '',
  assigned_by: '',
  parts_required: [] as string[],
  priority: 'medium',
  notes: '',
}

const EMPTY_COMPLETE_FORM = {
  service_date: '',
  performed_by: '',
  work_done: [] as string[],
  parts_used: [] as string[],
  completion_notes: '',
}

// ── Priority badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === 'critical' ? 'bg-red-100 text-red-800' :
    priority === 'high'     ? 'bg-orange-100 text-orange-800' :
    priority === 'medium'   ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
  return <span className={`badge ${cls}`}>{priority}</span>
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'completed'  ? 'bg-green-100 text-green-800' :
    status === 'in-progress'? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
  return <span className={`badge ${cls}`}>{status}</span>
}

function ServiceStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Overdue'    ? 'bg-red-100 text-red-800' :
    status === 'Due Today'  ? 'bg-orange-100 text-orange-800' :
    status === 'Due Soon'   ? 'bg-yellow-100 text-yellow-800' :
    status === 'On Schedule'? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-600'
  return <span className={`badge ${cls}`}>{status}</span>
}

// ── Main component ────────────────────────────────────────────────────────────

const HIST_PAGE_SIZE = 50

export default function ServiceNow() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<'due' | 'history'>('due')
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Due equipment section
  const [dueEquipment, setDueEquipment] = useState<DueEquipment[]>([])
  const [dueSearch, setDueSearch] = useState('')
  const [duePlantId, setDuePlantId] = useState<number | null>(null)
  const [dueStatusFilter, setDueStatusFilter] = useState('')
  const [duePage, setDuePage] = useState(0)
  const [dueLoading, setDueLoading] = useState(false)

  // Manual equipment picker (cascading dropdowns)
  const [manualPlantId, setManualPlantId] = useState<number | null>(null)
  const [manualGroupId, setManualGroupId] = useState<number | null>(null)
  const [manualGroups, setManualGroups] = useState<EquipmentGroup[]>([])
  const [manualEquipmentList, setManualEquipmentList] = useState<Equipment[]>([])
  const [manualEquipmentId, setManualEquipmentId] = useState<number | null>(null)

  // Open job cards (table display — filtered by user-selected status)
  const [jobCards, setJobCards] = useState<ServiceJobCard[]>([])
  const [jobCardSearch, setJobCardSearch] = useState('')
  const [jobCardStatus, setJobCardStatus] = useState('open')
  const [jobCardsTotal, setJobCardsTotal] = useState(0)
  const [jobCardsPage, setJobCardsPage] = useState(0)
  const JC_PAGE_SIZE = 20

  // Active job cards lookup — always non-completed, used by equipment row buttons
  const [activeCardsByEquipmentId, setActiveCardsByEquipmentId] = useState<Record<number, ServiceJobCard>>({})

  // Job card form modal
  const [jcModal, setJcModal] = useState<'create' | 'view' | null>(null)
  const [jcForm, setJcForm] = useState({ ...EMPTY_JC_FORM })
  const [jcFormEquipmentLabel, setJcFormEquipmentLabel] = useState('')
  const [viewingCard, setViewingCard] = useState<ServiceJobCard | null>(null)
  const [jcSaving, setJcSaving] = useState(false)
  const [jcError, setJcError] = useState('')

  // Complete form (inside view modal)
  const [showCompleteForm, setShowCompleteForm] = useState(false)
  const [completeForm, setCompleteForm] = useState({ ...EMPTY_COMPLETE_FORM })
  const [completing, setCompleting] = useState(false)

  // Service history section
  const [histRecords, setHistRecords] = useState<EnrichedServiceHistory[]>([])
  const [histTotal, setHistTotal] = useState(0)
  const [histPage, setHistPage] = useState(0)
  const [histLoading, setHistLoading] = useState(false)
  const [histExporting, setHistExporting] = useState(false)
  const [histSearch, setHistSearch] = useState('')
  const [histPlantId, setHistPlantId] = useState<number | null>(null)
  const [histGroupId, setHistGroupId] = useState<number | null>(null)
  const [histGroups, setHistGroups] = useState<EquipmentGroup[]>([])
  const [histDateFrom, setHistDateFrom] = useState('')
  const [histDateTo, setHistDateTo] = useState('')
  const [histArtisan, setHistArtisan] = useState('')
  const [histServiceType, setHistServiceType] = useState('')

  // Service history detail modal
  const [selectedHistory, setSelectedHistory] = useState<EnrichedServiceHistory | null>(null)
  const [histPrinting, setHistPrinting] = useState(false)

  // Load plants + initial data
  useEffect(() => {
    Promise.all([getPlants(), loadDueEquipment(), loadJobCards(), loadActiveCards()])
      .then(([p]) => {
        setPlants(p)
        const card = (location.state as any)?.openJobCard
        if (card) openViewModal(card)
        const histId = (location.state as any)?.openServiceHistoryId
        if (histId) {
          getServiceHistoryRecord(histId).then(setSelectedHistory).catch(() => {})
          setActiveTab('history')
        }
      })
      .catch((e) => setError(e?.response?.data?.detail || 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadDueEquipment() }, [dueSearch, duePlantId])
  useEffect(() => { setDuePage(0) }, [dueSearch, duePlantId, dueStatusFilter])

  useEffect(() => {
    if (manualPlantId) {
      getEquipmentGroups(manualPlantId).then(setManualGroups)
    } else {
      setManualGroups([])
    }
    setManualGroupId(null)
    setManualEquipmentId(null)
  }, [manualPlantId])

  useEffect(() => {
    if (!manualPlantId) { setManualEquipmentList([]); return }
    getEquipment({ plant_id: manualPlantId, equipment_group_id: manualGroupId || undefined, limit: 1000 })
      .then((res) => setManualEquipmentList(res.equipment))
    setManualEquipmentId(null)
  }, [manualPlantId, manualGroupId])
  useEffect(() => { setJobCardsPage(0) }, [jobCardSearch, jobCardStatus])
  useEffect(() => { loadJobCards() }, [jobCardSearch, jobCardStatus, jobCardsPage])
  useEffect(() => { if (activeTab === 'history') loadHistory() }, [activeTab, histPage])
  useEffect(() => {
    if (histPlantId) {
      getEquipmentGroups(histPlantId).then(setHistGroups)
    } else {
      setHistGroups([])
    }
    setHistGroupId(null)
  }, [histPlantId])

  async function loadDueEquipment() {
    setDueLoading(true)
    try {
      const items = await getDueEquipment({ search: dueSearch || undefined, plant_id: duePlantId || undefined })
      setDueEquipment(items)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load due equipment')
    } finally {
      setDueLoading(false)
    }
  }

  async function loadJobCards() {
    try {
      const res = await getJobCards({
        status: jobCardStatus || undefined,
        search: jobCardSearch || undefined,
        skip: jobCardsPage * JC_PAGE_SIZE,
        limit: JC_PAGE_SIZE,
      })
      setJobCards(res.job_cards)
      setJobCardsTotal(res.total)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load job cards')
    }
  }

  async function loadActiveCards() {
    try {
      const res = await getJobCards({ limit: 1000 })
      const map: Record<number, ServiceJobCard> = {}
      for (const card of res.job_cards) {
        if (card.status !== 'completed') {
          map[card.equipment_id] = card
        }
      }
      setActiveCardsByEquipmentId(map)
    } catch {
      // non-fatal — button state falls back to "Service"
    }
  }

  function histFilterParams() {
    return {
      plant_id: histPlantId || undefined,
      equipment_group_id: histGroupId || undefined,
      date_from: histDateFrom || undefined,
      date_to: histDateTo || undefined,
      artisan: histArtisan || undefined,
      service_type: histServiceType || undefined,
      search: histSearch || undefined,
    }
  }

  async function loadHistory() {
    setHistLoading(true)
    try {
      const res = await getEnrichedServiceHistory({
        ...histFilterParams(),
        skip: histPage * HIST_PAGE_SIZE,
        limit: HIST_PAGE_SIZE,
      })
      setHistRecords(res.records)
      setHistTotal(res.total)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load history')
    } finally {
      setHistLoading(false)
    }
  }

  async function handleExportHistory() {
    setHistExporting(true)
    try {
      const { blob, filename } = await exportServiceHistoryCsv(histFilterParams())
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to export')
    } finally {
      setHistExporting(false)
    }
  }

  function openCreateModal(eq: DueEquipment | Equipment) {
    setJcForm({
      ...EMPTY_JC_FORM,
      equipment_id: eq.id,
      plant_id: eq.plant_id,
      service_type: eq.service_type || '',
      due_date: eq.next_service_date || '',
      _next_service_date: eq.next_service_date || '',
    })
    setJcFormEquipmentLabel(`${eq.equipment_name}${eq.equipment_code ? ' (' + eq.equipment_code + ')' : ''} — ${eq.plant_name ?? 'Unassigned'}`)
    setJcError('')
    setJcModal('create')
  }

  function openViewModal(card: ServiceJobCard) {
    setViewingCard(card)
    setShowCompleteForm(false)
    setCompleteForm({ ...EMPTY_COMPLETE_FORM })
    setJcError('')
    setJcModal('view')
  }

  function openViewModalWithComplete(card: ServiceJobCard) {
    setViewingCard(card)
    setShowCompleteForm(true)
    setCompleteForm({
      ...EMPTY_COMPLETE_FORM,
      work_done: parseListField(card.work_to_be_done),
      parts_used: parseListField(card.parts_required),
    })
    setJcError('')
    setJcModal('view')
  }

  function closeModal() {
    setJcModal(null)
    setViewingCard(null)
    setShowCompleteForm(false)
    setJcError('')
  }

  function buildJobCardPayload() {
    return {
      equipment_id: jcForm.equipment_id!,
      plant_id: jcForm.plant_id,
      service_type: jcForm.service_type || null,
      start_date: jcForm.start_date || null,
      due_date: jcForm.due_date || null,
      service_description: jcForm.service_description || null,
      work_to_be_done: serializeListField(jcForm.work_to_be_done),
      assigned_artisan: jcForm.assigned_artisan || null,
      assigned_by: jcForm.assigned_by || null,
      parts_required: serializeListField(jcForm.parts_required),
      priority: jcForm.priority,
      notes: jcForm.notes || null,
    }
  }

  async function handleSaveJobCard() {
    if (!jcForm.equipment_id) { setJcError('Equipment is required'); return }
    setJcSaving(true)
    setJcError('')
    try {
      await createJobCard(buildJobCardPayload())
      closeModal()
      setManualEquipmentId(null)
      await Promise.all([loadDueEquipment(), loadJobCards(), loadActiveCards()])
    } catch (e: any) {
      setJcError(e?.response?.data?.detail || 'Failed to save job card')
    } finally {
      setJcSaving(false)
    }
  }

  async function handleSaveAndPrint() {
    if (!jcForm.equipment_id) { setJcError('Equipment is required'); return }
    setJcSaving(true)
    setJcError('')
    try {
      const card = await createJobCard(buildJobCardPayload())
      closeModal()
      setManualEquipmentId(null)
      printJobCard(card)
      await Promise.all([loadDueEquipment(), loadJobCards(), loadActiveCards()])
    } catch (e: any) {
      setJcError(e?.response?.data?.detail || 'Failed to save job card')
    } finally {
      setJcSaving(false)
    }
  }

  async function handleUpdateJobCard() {
    if (!viewingCard) return
    setJcSaving(true)
    setJcError('')
    try {
      const updated = await updateJobCard(viewingCard.id, {
        service_type: viewingCard.service_type,
        start_date: viewingCard.start_date,
        due_date: viewingCard.due_date,
        service_description: viewingCard.service_description,
        work_to_be_done: viewingCard.work_to_be_done,
        assigned_artisan: viewingCard.assigned_artisan,
        assigned_by: viewingCard.assigned_by,
        parts_required: viewingCard.parts_required,
        priority: viewingCard.priority,
        notes: viewingCard.notes,
        status: viewingCard.status,
      })
      setViewingCard(updated)
      await loadJobCards()
    } catch (e: any) {
      setJcError(e?.response?.data?.detail || 'Failed to update job card')
    } finally {
      setJcSaving(false)
    }
  }

  async function handleCompleteJobCard() {
    if (!viewingCard || !completeForm.service_date) {
      setJcError('Service date is required')
      return
    }
    setCompleting(true)
    setJcError('')
    try {
      await completeJobCard(viewingCard.id, {
        service_date: completeForm.service_date,
        performed_by: completeForm.performed_by || null,
        work_done: serializeListField(completeForm.work_done),
        parts_used: serializeListField(completeForm.parts_used),
        completion_notes: completeForm.completion_notes || null,
      })
      closeModal()
      await Promise.all([loadDueEquipment(), loadJobCards(), loadActiveCards()])
    } catch (e: any) {
      setJcError(e?.response?.data?.detail || 'Failed to complete job card')
    } finally {
      setCompleting(false)
    }
  }

  async function handleDeleteJobCard(id: number) {
    if (!confirm('Delete this job card?')) return
    try {
      await deleteJobCard(id)
      await Promise.all([loadJobCards(), loadActiveCards()])
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete job card')
    }
  }

  const overdueCount    = dueEquipment.filter((e) => e.service_status === 'Overdue').length
  const dueTodayCount   = dueEquipment.filter((e) => e.service_status === 'Due Today').length
  const dueWithin7Count = dueEquipment.filter((e) => e.service_status === 'Due Soon' || e.service_status === 'Due Today').length
  const openCardCount   = Object.keys(activeCardsByEquipmentId).length

  const DUE_PAGE_SIZE = 20
  const filteredDueEquipment = dueStatusFilter
    ? dueEquipment.filter((e) => e.service_status === dueStatusFilter)
    : dueEquipment
  const dueTotalPages = Math.ceil(filteredDueEquipment.length / DUE_PAGE_SIZE)
  const pagedDueEquipment = filteredDueEquipment.slice(duePage * DUE_PAGE_SIZE, (duePage + 1) * DUE_PAGE_SIZE)
  const jcTotalPages = Math.ceil(jobCardsTotal / JC_PAGE_SIZE)

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'due', label: 'Service Due / Job Cards', icon: ClipboardList },
          { key: 'history', label: 'Service History', icon: History },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Service Due / Job Cards ── */}
      {activeTab === 'due' && (
        <div className="space-y-6">
          {/* Summary banners */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl bg-purple-100 border border-purple-200 p-4 flex items-center gap-4">
              <div className="rounded-full bg-purple-200 p-3"><AlertTriangle className="h-5 w-5 text-purple-700" /></div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{overdueCount}</p>
                <p className="text-xs text-purple-500">Overdue</p>
              </div>
            </div>
            <div className="rounded-xl bg-red-100 border border-red-200 p-4 flex items-center gap-4">
              <div className="rounded-full bg-red-200 p-3"><AlertTriangle className="h-5 w-5 text-red-700" /></div>
              <div>
                <p className="text-2xl font-bold text-red-700">{dueTodayCount}</p>
                <p className="text-xs text-red-500">Due Today</p>
              </div>
            </div>
            <div className="rounded-xl bg-yellow-100 border border-yellow-200 p-4 flex items-center gap-4">
              <div className="rounded-full bg-yellow-200 p-3"><AlertTriangle className="h-5 w-5 text-yellow-700" /></div>
              <div>
                <p className="text-2xl font-bold text-yellow-700">{dueWithin7Count}</p>
                <p className="text-xs text-yellow-600">Due within 7 days</p>
              </div>
            </div>
            <div className="rounded-xl bg-blue-100 border border-blue-200 p-4 flex items-center gap-4">
              <div className="rounded-full bg-blue-200 p-3"><ClipboardList className="h-5 w-5 text-blue-700" /></div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{openCardCount}</p>
                <p className="text-xs text-blue-500">Open Job Cards</p>
              </div>
            </div>
          </div>

          {/* Due Equipment table */}
          <div className="card space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-semibold text-gray-700">Equipment Due for Service</h2>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  className="input text-sm py-1.5 w-40"
                  placeholder="Filter by name…"
                  value={dueSearch}
                  onChange={(e) => setDueSearch(e.target.value)}
                />
                <select
                  className="input text-sm py-1.5 w-40"
                  value={duePlantId ?? ''}
                  onChange={(e) => setDuePlantId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">All plants</option>
                  {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select
                  className="input text-sm py-1.5 w-36"
                  value={dueStatusFilter}
                  onChange={(e) => setDueStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Due Today">Due Today</option>
                  <option value="Due Soon">Due Soon</option>
                </select>
              </div>
            </div>

            {dueLoading ? (
              <div className="flex h-24 items-center justify-center"><LoadingSpinner /></div>
            ) : (
              <>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Equipment</th>
                      <th>Plant</th>
                      <th>Service Type</th>
                      <th>Last Service</th>
                      <th>Next Due</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDueEquipment.map((eq) => (
                      <tr key={eq.id}>
                        <td>
                          <div className="font-medium">{eq.equipment_name}</div>
                          {eq.equipment_code && <div className="text-xs font-mono text-gray-400">{eq.equipment_code}</div>}
                        </td>
                        <td className="text-gray-500">{eq.plant_name ?? '—'}</td>
                        <td className="text-sm text-gray-600">{eq.service_type ?? '—'}</td>
                        <td className="text-sm text-gray-600">{eq.last_service_date ?? '—'}</td>
                        <td className="text-sm text-gray-600">{eq.next_service_date ?? '—'}</td>
                        <td><ServiceStatusBadge status={eq.service_status} /></td>
                        <td>
                          {activeCardsByEquipmentId[eq.id] ? (
                            <button
                              onClick={() => openViewModalWithComplete(activeCardsByEquipmentId[eq.id])}
                              className="w-32 justify-center btn-sm flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Mark Complete
                            </button>
                          ) : (
                            <button
                              onClick={() => openCreateModal(eq)}
                              className="w-32 justify-center btn-sm flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Service Now
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredDueEquipment.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-gray-400 py-8">No equipment found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {dueTotalPages > 1 && (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-gray-500">
                    Showing {duePage * DUE_PAGE_SIZE + 1}–{Math.min((duePage + 1) * DUE_PAGE_SIZE, filteredDueEquipment.length)} of {filteredDueEquipment.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="btn-secondary btn-sm" disabled={duePage === 0} onClick={() => setDuePage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />Previous
                    </button>
                    <span className="text-sm text-gray-600">{duePage + 1} / {dueTotalPages}</span>
                    <button className="btn-secondary btn-sm" disabled={duePage >= dueTotalPages - 1} onClick={() => setDuePage((p) => p + 1)}>
                      Next<ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>

          {/* Manual equipment picker */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-700">Create Job Card for Any Equipment</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="label">Plant</label>
                <select
                  className="input"
                  value={manualPlantId ?? ''}
                  onChange={(e) => setManualPlantId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select plant…</option>
                  {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="label">Group</label>
                <select
                  className="input"
                  value={manualGroupId ?? ''}
                  disabled={!manualPlantId}
                  onChange={(e) => setManualGroupId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{manualPlantId ? 'All groups' : 'Select a plant first'}</option>
                  {manualGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="label">Equipment</label>
                <select
                  className="input"
                  value={manualEquipmentId ?? ''}
                  disabled={!manualPlantId}
                  onChange={(e) => setManualEquipmentId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{manualPlantId ? 'Select equipment…' : 'Select a plant first'}</option>
                  {manualEquipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.equipment_name}{eq.equipment_code ? ` (${eq.equipment_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(() => {
              const eq = manualEquipmentList.find((e) => e.id === manualEquipmentId) ?? null
              if (!eq) return null
              return (
                <div className="flex flex-col gap-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Status: </span>
                      <ServiceStatusBadge status={eq.service_status ?? 'Not Scheduled'} />
                    </div>
                    {eq.next_service_date && (
                      <div>
                        <span className="text-gray-500">Next due: </span>
                        <span className="text-gray-700">{eq.next_service_date}</span>
                      </div>
                    )}
                    {eq.last_service_date && (
                      <div>
                        <span className="text-gray-500">Last service: </span>
                        <span className="text-gray-700">{eq.last_service_date}</span>
                      </div>
                    )}
                  </div>
                  {activeCardsByEquipmentId[eq.id] ? (
                    <button
                      onClick={() => openViewModalWithComplete(activeCardsByEquipmentId[eq.id])}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors shrink-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Mark Complete
                    </button>
                  ) : (
                    <button
                      onClick={() => openCreateModal(eq)}
                      className="btn-primary btn-sm flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Service
                    </button>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Open job cards table */}
          <div className="card space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-semibold text-gray-700">Job Cards ({jobCardsTotal})</h2>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  className="input text-sm py-1.5 w-48"
                  placeholder="Search job cards…"
                  value={jobCardSearch}
                  onChange={(e) => setJobCardSearch(e.target.value)}
                />
                <select
                  className="input text-sm py-1.5 w-36"
                  value={jobCardStatus}
                  onChange={(e) => setJobCardStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Job Card #</th>
                    <th>Equipment</th>
                    <th>Plant</th>
                    <th>Artisan</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {jobCards.map((jc) => (
                    <tr key={jc.id} className="cursor-pointer" onClick={() => openViewModal(jc)}>
                      <td className="font-mono text-xs text-gray-600">{jc.job_card_number}</td>
                      <td className="font-medium">{jc.equipment_name ?? '—'}</td>
                      <td className="text-gray-500">{jc.plant_name ?? '—'}</td>
                      <td className="text-sm text-gray-600">{jc.assigned_artisan ?? '—'}</td>
                      <td><PriorityBadge priority={jc.priority} /></td>
                      <td className="text-sm text-gray-600">{jc.due_date ?? '—'}</td>
                      <td><StatusBadge status={jc.status} /></td>
                      <td>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { printJobCard(jc) }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Print">
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          {jc.status !== 'completed' && (
                            <button onClick={() => handleDeleteJobCard(jc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {jobCards.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-gray-400 py-8">No job cards found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {jcTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {jobCardsPage * JC_PAGE_SIZE + 1}–{Math.min((jobCardsPage + 1) * JC_PAGE_SIZE, jobCardsTotal)} of {jobCardsTotal}
                </p>
                <div className="flex items-center gap-2">
                  <button className="btn-secondary btn-sm" disabled={jobCardsPage === 0} onClick={() => setJobCardsPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />Previous
                  </button>
                  <span className="text-sm text-gray-600">{jobCardsPage + 1} / {jcTotalPages}</span>
                  <button className="btn-secondary btn-sm" disabled={jobCardsPage >= jcTotalPages - 1} onClick={() => setJobCardsPage((p) => p + 1)}>
                    Next<ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Service History ── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <label className="label">Equipment</label>
                <input type="text" className="input" placeholder="Search by name…" value={histSearch} onChange={(e) => setHistSearch(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="label">Plant</label>
                <select className="input" value={histPlantId ?? ''} onChange={(e) => setHistPlantId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">All plants</option>
                  {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="label">Group</label>
                <select
                  className="input"
                  value={histGroupId ?? ''}
                  disabled={!histPlantId}
                  onChange={(e) => setHistGroupId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{histPlantId ? 'All groups' : 'Select a plant first'}</option>
                  {histGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="label">Service Type</label>
                <input type="text" className="input" placeholder="Filter…" value={histServiceType} onChange={(e) => setHistServiceType(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="label">Date From</label>
                <input type="date" className="input" value={histDateFrom} onChange={(e) => setHistDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="label">Date To</label>
                <input type="date" className="input" value={histDateTo} onChange={(e) => setHistDateTo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="label">Artisan</label>
                <input type="text" className="input" placeholder="Filter…" value={histArtisan} onChange={(e) => setHistArtisan(e.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button onClick={() => { setHistPage(0); loadHistory() }} className="btn-primary btn-sm flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Apply Filters
              </button>
              <button onClick={() => {
                setHistSearch(''); setHistPlantId(null); setHistGroupId(null); setHistGroups([])
                setHistDateFrom(''); setHistDateTo(''); setHistArtisan(''); setHistServiceType(''); setHistPage(0)
              }} className="btn-secondary btn-sm">Clear</button>
              <button onClick={handleExportHistory} disabled={histExporting} className="btn-secondary btn-sm flex items-center gap-1.5 ml-auto">
                {histExporting ? <LoadingSpinner size="sm" /> : <Download className="h-3.5 w-3.5" />}
                Export CSV
              </button>
            </div>
          </div>

          {histLoading ? (
            <div className="flex h-24 items-center justify-center"><LoadingSpinner /></div>
          ) : (
            <>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Equipment</th>
                      <th>Plant</th>
                      <th>Service Type</th>
                      <th>Performed By</th>
                      <th>Work Done</th>
                      <th>Parts Used</th>
                      <th>Job Card</th>
                    </tr>
                  </thead>
                  <tbody>
                    {histRecords.map((r) => (
                      <tr key={r.id} className="cursor-pointer hover:bg-blue-50/40 transition-colors" onClick={() => setSelectedHistory(r)}>
                        <td className="text-sm text-gray-600 whitespace-nowrap">{r.service_date}</td>
                        <td>
                          <div className="font-medium">{r.equipment_name ?? '—'}</div>
                          {r.equipment_code && <div className="text-xs font-mono text-gray-400">{r.equipment_code}</div>}
                        </td>
                        <td className="text-gray-500">{r.plant_name ?? '—'}</td>
                        <td className="text-sm text-gray-600">{r.service_type ?? '—'}</td>
                        <td className="text-sm text-gray-600">{r.performed_by ?? '—'}</td>
                        <td className="text-sm text-gray-600 max-w-[200px] truncate">{r.work_done ?? r.notes ?? '—'}</td>
                        <td className="text-sm text-gray-600">{r.parts_used ?? '—'}</td>
                        <td>
                          {r.job_card_number
                            ? <span className="font-mono text-xs text-blue-600">{r.job_card_number}</span>
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {histRecords.length === 0 && (
                      <tr><td colSpan={8} className="text-center text-gray-400 py-8">No service history records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {histTotal > HIST_PAGE_SIZE && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Showing {histPage * HIST_PAGE_SIZE + 1}–{Math.min((histPage + 1) * HIST_PAGE_SIZE, histTotal)} of {histTotal}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn-secondary btn-sm" disabled={histPage === 0} onClick={() => setHistPage((p) => Math.max(0, p - 1))}>
                      <ChevronLeft className="h-4 w-4" />Previous
                    </button>
                    <span className="text-sm text-gray-600">Page {histPage + 1} of {Math.ceil(histTotal / HIST_PAGE_SIZE)}</span>
                    <button className="btn-secondary btn-sm" disabled={histPage >= Math.ceil(histTotal / HIST_PAGE_SIZE) - 1} onClick={() => setHistPage((p) => p + 1)}>
                      Next<ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Create Job Card Modal ── */}
      {jcModal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={closeModal}>
          <div className="card w-full max-w-2xl my-8 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">New Service Job Card</h2>
              <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {jcError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{jcError}</div>
            )}

            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
              <span className="font-medium">Equipment:</span> {jcFormEquipmentLabel}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="label">Service Type</label>
                <input type="text" className="input" value={jcForm.service_type} onChange={(e) => setJcForm((f) => ({ ...f, service_type: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="label">Priority</label>
                <select className="input" value={jcForm.priority} onChange={(e) => setJcForm((f) => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="label">Start Date</label>
                <input type="date" className="input" value={jcForm.start_date} onChange={(e) => setJcForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="label">Due Date</label>
                <input type="date" className="input" value={jcForm.due_date} onChange={(e) => setJcForm((f) => ({ ...f, due_date: e.target.value }))} />
                {jcForm._next_service_date && (
                  <p className="text-xs text-gray-400">Next scheduled service: {jcForm._next_service_date}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="label">Assigned Artisan</label>
                <input type="text" className="input" value={jcForm.assigned_artisan} onChange={(e) => setJcForm((f) => ({ ...f, assigned_artisan: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="label">Assigned By</label>
                <input type="text" className="input" value={jcForm.assigned_by} onChange={(e) => setJcForm((f) => ({ ...f, assigned_by: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="label">Service Description</label>
                <textarea className="input resize-none" rows={2} value={jcForm.service_description} onChange={(e) => setJcForm((f) => ({ ...f, service_description: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="label">Work To Be Done</label>
                <ListInput items={jcForm.work_to_be_done} onChange={(items) => setJcForm((f) => ({ ...f, work_to_be_done: items }))} placeholder="Add task…" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="label">Parts Required</label>
                <ListInput items={jcForm.parts_required} onChange={(items) => setJcForm((f) => ({ ...f, parts_required: items }))} placeholder="Add part…" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={jcForm.notes} onChange={(e) => setJcForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-2 pt-2 flex-wrap">
              <button onClick={handleSaveJobCard} disabled={jcSaving} className="btn-primary flex items-center gap-1.5">
                {jcSaving ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                Save
              </button>
              <button onClick={handleSaveAndPrint} disabled={jcSaving} className="btn-secondary flex items-center gap-1.5">
                <Printer className="h-4 w-4" />
                Save &amp; Print
              </button>
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── View / Edit Job Card Modal ── */}
      {jcModal === 'view' && viewingCard && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={closeModal}>
          <div className="card w-full max-w-2xl my-8 space-y-5" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{viewingCard.job_card_number}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={viewingCard.status} />
                  <PriorityBadge priority={viewingCard.priority} />
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => printJobCard(viewingCard)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Print">
                  <Printer className="h-4 w-4" />
                </button>
                <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors ml-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {jcError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{jcError}</div>
            )}

            {/* Info */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4 sm:grid-cols-3">
              {[
                ['Equipment', `${viewingCard.equipment_name ?? '—'}${viewingCard.equipment_code ? ' (' + viewingCard.equipment_code + ')' : ''}`],
                ['Plant', viewingCard.plant_name ?? '—'],
                ['Created By', viewingCard.created_by_user_name ?? '—'],
                ['Assigned Artisan', viewingCard.assigned_artisan ?? '—'],
                ['Assigned By', viewingCard.assigned_by ?? '—'],
                ['Start Date', viewingCard.start_date ?? '—'],
                ['Due Date', viewingCard.due_date ?? '—'],
                ['Completed', viewingCard.completed_date ?? '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className="mt-1 text-sm text-gray-800">{value}</p>
                </div>
              ))}
            </div>

            {/* Editable fields (when open/in-progress) */}
            {viewingCard.status !== 'completed' ? (
              <div className="space-y-4 border-t pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="label">Service Type</label>
                    <input type="text" className="input" value={viewingCard.service_type ?? ''} onChange={(e) => setViewingCard((c) => c ? { ...c, service_type: e.target.value } : c)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Priority</label>
                    <select className="input" value={viewingCard.priority} onChange={(e) => setViewingCard((c) => c ? { ...c, priority: e.target.value } : c)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="label">Start Date</label>
                    <input type="date" className="input" value={viewingCard.start_date ?? ''} onChange={(e) => setViewingCard((c) => c ? { ...c, start_date: e.target.value } : c)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Due Date</label>
                    <input type="date" className="input" value={viewingCard.due_date ?? ''} onChange={(e) => setViewingCard((c) => c ? { ...c, due_date: e.target.value } : c)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Assigned Artisan</label>
                    <input type="text" className="input" value={viewingCard.assigned_artisan ?? ''} onChange={(e) => setViewingCard((c) => c ? { ...c, assigned_artisan: e.target.value } : c)} />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Assigned By</label>
                    <input type="text" className="input" value={viewingCard.assigned_by ?? ''} onChange={(e) => setViewingCard((c) => c ? { ...c, assigned_by: e.target.value } : c)} />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="label">Status</label>
                    <select className="input" value={viewingCard.status} onChange={(e) => setViewingCard((c) => c ? { ...c, status: e.target.value } : c)}>
                      <option value="open">Open</option>
                      <option value="in-progress">In Progress</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="label">Work To Be Done</label>
                    <ListInput
                      items={parseListField(viewingCard.work_to_be_done)}
                      onChange={(items) => setViewingCard((c) => c ? { ...c, work_to_be_done: serializeListField(items) } : c)}
                      placeholder="Add task…"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="label">Parts Required</label>
                    <ListInput
                      items={parseListField(viewingCard.parts_required)}
                      onChange={(items) => setViewingCard((c) => c ? { ...c, parts_required: serializeListField(items) } : c)}
                      placeholder="Add part…"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="label">Notes</label>
                    <textarea className="input resize-none" rows={2} value={viewingCard.notes ?? ''} onChange={(e) => setViewingCard((c) => c ? { ...c, notes: e.target.value } : c)} />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={handleUpdateJobCard} disabled={jcSaving} className="btn-secondary btn-sm flex items-center gap-1.5">
                    {jcSaving ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                    Save Changes
                  </button>
                  {!showCompleteForm && (
                    <button
                      onClick={() => {
                        setShowCompleteForm(true)
                        if (viewingCard) {
                          setCompleteForm({
                            ...EMPTY_COMPLETE_FORM,
                            work_done: parseListField(viewingCard.work_to_be_done),
                            parts_used: parseListField(viewingCard.parts_required),
                          })
                        }
                      }}
                      className="btn-primary btn-sm flex items-center gap-1.5"
                    >
                      <Check className="h-4 w-4" />
                      Mark as Completed
                    </button>
                  )}
                </div>

                {/* Complete form */}
                {showCompleteForm && (
                  <div className="space-y-4 rounded-lg bg-green-50 border border-green-200 p-4">
                    <h3 className="text-sm font-semibold text-green-800">Complete Service</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="label">Service Date *</label>
                        <input type="date" className="input" value={completeForm.service_date} onChange={(e) => setCompleteForm((f) => ({ ...f, service_date: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="label">Performed By</label>
                        <input
                          type="text"
                          className="input"
                          placeholder={viewingCard?.assigned_artisan || ''}
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
                      <button onClick={handleCompleteJobCard} disabled={completing} className="btn-primary btn-sm flex items-center gap-1.5">
                        {completing ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                        Confirm Complete
                      </button>
                      <button onClick={() => setShowCompleteForm(false)} className="btn-secondary btn-sm">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Read-only completed view */
              <div className="space-y-3 border-t pt-4">
                {[
                  ['Service Type', viewingCard.service_type],
                  ['Start Date', viewingCard.start_date],
                  ['Assigned By', viewingCard.assigned_by],
                  ['Notes', viewingCard.notes],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label as string}</p>
                    <p className="mt-1 text-sm text-gray-800">{value as string}</p>
                  </div>
                ))}
                {parseListField(viewingCard.work_to_be_done).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Work To Be Done</p>
                    <ul className="mt-1 space-y-1">
                      {parseListField(viewingCard.work_to_be_done).map((item, i) => (
                        <li key={i} className="text-sm text-gray-800 flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {parseListField(viewingCard.parts_required).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Parts Required</p>
                    <ul className="mt-1 space-y-1">
                      {parseListField(viewingCard.parts_required).map((item, i) => (
                        <li key={i} className="text-sm text-gray-800 flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Service History Detail Modal ── */}
      {selectedHistory && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => setSelectedHistory(null)}
        >
          <div className="card w-full max-w-2xl my-8 space-y-5" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Service Record</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedHistory.service_date}</p>
              </div>
              <button
                onClick={() => setSelectedHistory(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-t pt-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Equipment</p>
                <p className="mt-1 text-sm text-gray-800">
                  {selectedHistory.equipment_name ?? '—'}
                  {selectedHistory.equipment_code && (
                    <span className="ml-1 font-mono text-xs text-gray-400">({selectedHistory.equipment_code})</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plant</p>
                <p className="mt-1 text-sm text-gray-800">{selectedHistory.plant_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Group</p>
                <p className="mt-1 text-sm text-gray-800">{selectedHistory.equipment_group_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Service Date</p>
                <p className="mt-1 text-sm text-gray-800">{selectedHistory.service_date}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Service Type</p>
                <p className="mt-1 text-sm text-gray-800">{selectedHistory.service_type ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Performed By</p>
                <p className="mt-1 text-sm text-gray-800">{selectedHistory.performed_by ?? '—'}</p>
              </div>

              {/* Job Card with print icon */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Job Card</p>
                <div className="mt-1 flex items-center gap-2">
                  {selectedHistory.job_card_number ? (
                    <>
                      <span className="font-mono text-sm text-blue-600">{selectedHistory.job_card_number}</span>
                      <button
                        title="Print job card"
                        disabled={histPrinting}
                        onClick={async () => {
                          if (!selectedHistory.job_card_id) return
                          setHistPrinting(true)
                          try {
                            const card = await getJobCard(selectedHistory.job_card_id)
                            printJobCard(card)
                          } finally {
                            setHistPrinting(false)
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        {histPrinting ? <LoadingSpinner size="sm" /> : <Printer className="h-3.5 w-3.5" />}
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-gray-800">—</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recorded At</p>
                <p className="mt-1 text-sm text-gray-800">
                  {selectedHistory.created_at ? new Date(selectedHistory.created_at).toLocaleString() : '—'}
                </p>
              </div>
            </div>

            {/* Work Done */}
            {(selectedHistory.work_done || selectedHistory.notes) && (
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Work Done</p>
                {(() => {
                  const items = parseListField(selectedHistory.work_done ?? selectedHistory.notes)
                  return items.length > 1 ? (
                    <ul className="space-y-1">
                      {items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{items[0] ?? '—'}</p>
                  )
                })()}
              </div>
            )}

            {/* Parts Used */}
            {selectedHistory.parts_used && (
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Parts Used</p>
                {(() => {
                  const items = parseListField(selectedHistory.parts_used)
                  return items.length > 1 ? (
                    <ul className="space-y-1">
                      {items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-800">{items[0] ?? '—'}</p>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
