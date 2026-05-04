import { useCallback, useState } from 'react'
import { AlertTriangle, CheckCircle, FileSpreadsheet, Upload } from 'lucide-react'
import { commitImport, commitEquipmentImport, previewEquipmentImport, previewImport } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'

type ImportType = 'maintenance' | 'equipment'
type Step = 'upload' | 'preview' | 'done'

interface PreviewData {
  sheets: string[]
  selected_sheet: string
  total_records: number
  preview: Record<string, unknown>[]
}

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>('maintenance')
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [sheetName, setSheetName] = useState<string>('')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [result, setResult] = useState<{ saved: number; created: number; updated: number; errors: { row: number; error: string }[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  function handleFile(f: File) {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      setError('Only .xlsx and .xls files are supported')
      return
    }
    setFile(f)
    setError('')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  async function handlePreview() {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const previewFunc = importType === 'maintenance' ? previewImport : previewEquipmentImport
      const data = await previewFunc(file, sheetName || undefined)
      setPreview(data)
      setSheetName(data.selected_sheet)
      setStep('preview')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to preview file')
    } finally {
      setLoading(false)
    }
  }

  async function handleSheetChange(name: string) {
    if (!file) return
    setSheetName(name)
    setLoading(true)
    try {
      const data = await previewImport(file, name)
      setPreview(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load sheet')
    } finally {
      setLoading(false)
    }
  }

  async function handleCommit() {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const commitFunc = importType === 'maintenance' ? commitImport : commitEquipmentImport
      const result = await commitFunc(file, sheetName || undefined)
      setResult(result)
      setStep('done')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep('upload')
    setFile(null)
    setSheetName('')
    setPreview(null)
    setResult(null)
    setError('')
  }

  if (step === 'done' && result) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="card text-center space-y-4">
          <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-800">Import Complete</h2>
          <p className="text-gray-600">
            <span className="font-semibold text-green-600">{result.saved}</span> records saved
            {result.errors.length > 0 && (
              <span className="text-red-500"> · {result.errors.length} errors</span>
            )}
          </p>
          <p className="text-sm text-gray-500">
            {result.created} created · {result.updated} updated
          </p>
          {result.errors.length > 0 && (
            <div className="text-left rounded-lg bg-red-50 border border-red-200 p-4 space-y-1 max-h-48 overflow-y-auto">
              {result.errors.map((e) => (
                <p key={e.row} className="text-xs text-red-600">
                  Row {e.row}: {e.error}
                </p>
              ))}
            </div>
          )}
          <button className="btn-primary mx-auto" onClick={reset}>Import Another File</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center gap-3 text-sm">
        {(['upload', 'preview', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-gray-300" />}
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step === s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i + 1}
            </div>
            <span className={step === s ? 'text-blue-600 font-medium' : 'text-gray-400'}>
              {s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview' : 'Done'}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div className="card space-y-6">
          {/* Import Type Selector */}
          <div>
            <h2 className="font-semibold text-gray-700 mb-3">Select Import Type</h2>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importType"
                  value="maintenance"
                  checked={importType === 'maintenance'}
                  onChange={(e) => setImportType(e.target.value as ImportType)}
                  className="text-blue-600"
                />
                <span className="text-sm font-medium">Maintenance Records</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importType"
                  value="equipment"
                  checked={importType === 'equipment'}
                  onChange={(e) => setImportType(e.target.value as ImportType)}
                  className="text-blue-600"
                />
                <span className="text-sm font-medium">Equipment</span>
              </label>
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-gray-700 mb-1">Upload Excel File</h2>
            <p className="text-sm text-gray-500">
              Upload your {importType === 'maintenance' ? 'maintenance log' : 'equipment list'} Excel file (.xlsx or .xls).
              The importer will auto-detect column headers.
            </p>
            {importType === 'maintenance' && (
              <p className="text-xs text-gray-500 mt-2">
                Note: Downtime is auto-calculated from arrival and finishing times when both are provided. If a matching record already exists, it will be updated instead of duplicated.
              </p>
            )}
            {importType === 'equipment' && (
              <p className="text-xs text-gray-500 mt-2">
                Note: Plants and equipment groups will be created automatically if they don't exist. Equipment with matching names will be updated.
              </p>
            )}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
              dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <FileSpreadsheet className={`h-12 w-12 mx-auto mb-3 ${file ? 'text-green-500' : 'text-gray-300'}`} />
            {file ? (
              <p className="text-sm font-medium text-gray-700">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-600">Drop your Excel file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
              </>
            )}
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="label">Sheet Name (optional)</label>
              <input
                type="text"
                className="input w-48"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
              />
            </div>
            <button
              className="btn-primary"
              disabled={!file || loading}
              onClick={handlePreview}
            >
              {loading ? <LoadingSpinner size="sm" /> : <Upload className="h-4 w-4" />}
              Preview Data
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-700">Preview</h2>
                <p className="text-sm text-gray-500">
                  Found <span className="font-semibold text-blue-600">{preview.total_records}</span> records on sheet{' '}
                  <span className="font-medium">{preview.selected_sheet}</span>. Showing first 20.
                </p>
              </div>

              {/* Sheet selector */}
              {preview.sheets.length > 1 && (
                <div>
                  <label className="label">Sheet</label>
                  <select
                    className="input w-44"
                    value={sheetName}
                    onChange={(e) => handleSheetChange(e.target.value)}
                  >
                    {preview.sheets.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Preview table */}
          <div className="table-container max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex h-32 items-center justify-center bg-white">
                <LoadingSpinner />
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    {preview.preview[0] && Object.keys(preview.preview[0]).map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="max-w-[150px] truncate" title={String(val ?? '')}>
                          {String(val ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex gap-3">
            <button className="btn-primary" onClick={handleCommit} disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : <CheckCircle className="h-4 w-4" />}
              Import All {preview.total_records} Records
            </button>
            <button className="btn-secondary" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
