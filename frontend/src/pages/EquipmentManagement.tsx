import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, Building2 } from 'lucide-react'
import {
  createEquipment,
  createPlant,
  deleteEquipment,
  deletePlant,
  getEquipment,
  getPlants,
  updateEquipment,
  updatePlant,
} from '../services/api'
import type { Equipment, Plant } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'

export default function EquipmentManagement() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlant, setSelectedPlant] = useState<number | null>(null)
  const [error, setError] = useState('')

  // Plant edit state
  const [editingPlant, setEditingPlant] = useState<number | null>(null)
  const [plantName, setPlantName] = useState('')
  const [newPlantName, setNewPlantName] = useState('')
  const [addingPlant, setAddingPlant] = useState(false)

  // Equipment edit state
  const [editingEquip, setEditingEquip] = useState<number | null>(null)
  const [equipForm, setEquipForm] = useState({
    name: '',
    code: '',
    status: 'active',
    plant_id: null as number | null,
  })
  const [newEquipForm, setNewEquipForm] = useState({
    name: '',
    code: '',
    status: 'active',
    plant_id: null as number | null,
  })
  const [addingEquip, setAddingEquip] = useState(false)

  useEffect(() => {
    Promise.all([getPlants(), getEquipment()])
      .then(([p, e]) => {
        setPlants(p)
        setEquipment(e)
      })
      .finally(() => setLoading(false))
  }, [])

  const visibleEquipment = selectedPlant
    ? equipment.filter((e) => e.plant_id === selectedPlant)
    : equipment

  // ── Plants ────────────────────────────────────────────────────────────────

  async function handleCreatePlant() {
    if (!newPlantName.trim()) return
    try {
      const p = await createPlant(newPlantName.trim())
      setPlants((prev) => [...prev, p])
      setNewPlantName('')
      setAddingPlant(false)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create plant')
    }
  }

  async function handleUpdatePlant(id: number) {
    try {
      const p = await updatePlant(id, plantName)
      setPlants((prev) => prev.map((x) => (x.id === id ? p : x)))
      setEditingPlant(null)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to update plant')
    }
  }

  async function handleDeletePlant(id: number) {
    if (!confirm('Delete this plant? Equipment assigned to it will be unassigned.')) return
    try {
      await deletePlant(id)
      setPlants((prev) => prev.filter((p) => p.id !== id))
      if (selectedPlant === id) setSelectedPlant(null)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete plant')
    }
  }

  // ── Equipment ─────────────────────────────────────────────────────────────

  async function handleCreateEquip() {
    if (!newEquipForm.name.trim()) return
    try {
      const eq = await createEquipment({
        equipment_name: newEquipForm.name.trim(),
        equipment_code: newEquipForm.code || null,
        plant_id: newEquipForm.plant_id,
        status: newEquipForm.status,
      })
      setEquipment((prev) => [...prev, eq])
      setNewEquipForm({
        name: '',
        code: '',
        status: 'active',
        plant_id: selectedPlant,
      })
      setAddingEquip(false)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create equipment')
    }
  }

  async function handleUpdateEquip(id: number) {
    try {
      const eq = await updateEquipment(id, {
        equipment_name: equipForm.name,
        equipment_code: equipForm.code || null,
        plant_id: equipForm.plant_id,
        status: equipForm.status,
      })
      setEquipment((prev) => prev.map((x) => (x.id === id ? eq : x)))
      setEditingEquip(null)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to update equipment')
    }
  }

  async function handleDeleteEquip(id: number) {
    if (!confirm('Delete this equipment?')) return
    try {
      await deleteEquipment(id)
      setEquipment((prev) => prev.filter((e) => e.id !== id))
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete equipment')
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {error && (
        <div className="col-span-full rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Plants panel */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Plants ({plants.length})
          </h2>
          <button
            className="btn-secondary btn-sm"
            onClick={() => setAddingPlant(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {addingPlant && (
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              className="input text-sm flex-1"
              placeholder="Plant name"
              value={newPlantName}
              onChange={(e) => setNewPlantName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePlant()}
            />
            <button onClick={handleCreatePlant} className="btn-primary btn-sm p-2"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setAddingPlant(false)} className="btn-secondary btn-sm p-2"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        <ul className="space-y-1">
          {plants.map((p) => (
            <li
              key={p.id}
              className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                selectedPlant === p.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
              }`}
              onClick={() => setSelectedPlant(selectedPlant === p.id ? null : p.id)}
            >
              {editingPlant === p.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    className="input text-sm flex-1 py-1"
                    value={plantName}
                    onChange={(e) => setPlantName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdatePlant(p.id)}
                  />
                  <button onClick={(e) => { e.stopPropagation(); handleUpdatePlant(p.id) }} className="text-green-600"><Check className="h-3.5 w-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingPlant(null) }} className="text-gray-400"><X className="h-3.5 w-3.5" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{p.name}</span>
                  <span className="text-xs text-gray-400">
                    {equipment.filter((e) => e.plant_id === p.id).length}
                  </span>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingPlant(p.id); setPlantName(p.name) }}
                      className="text-gray-400 hover:text-blue-600"
                    ><Pencil className="h-3 w-3" /></button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePlant(p.id) }}
                      className="text-gray-400 hover:text-red-600"
                    ><Trash2 className="h-3 w-3" /></button>
                  </div>
                </>
              )}
            </li>
          ))}
          {plants.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No plants yet</p>
          )}
        </ul>
      </div>

      {/* Equipment table */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">
            Equipment
            {selectedPlant && (
              <span className="ml-2 text-sm text-blue-600 font-normal">
                — {plants.find((p) => p.id === selectedPlant)?.name}
              </span>
            )}
            <span className="ml-2 text-sm text-gray-400">({visibleEquipment.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <select
              className="input text-sm py-1.5 w-48"
              value={selectedPlant ?? ''}
              onChange={(e) => setSelectedPlant(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All plants</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              className="btn-primary btn-sm"
              onClick={() => {
                setNewEquipForm((f) => ({ ...f, plant_id: selectedPlant }))
                setAddingEquip(true)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Equipment
            </button>
          </div>
        </div>

        {addingEquip && (
          <div className="card flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Name *</label>
              <input type="text" className="input" placeholder="Equipment name" value={newEquipForm.name} onChange={(e) => setNewEquipForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="w-32">
              <label className="label">Code</label>
              <input type="text" className="input" placeholder="Code" value={newEquipForm.code} onChange={(e) => setNewEquipForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="w-44">
              <label className="label">Plant</label>
              <select
                className="input"
                value={newEquipForm.plant_id ?? ''}
                onChange={(e) =>
                  setNewEquipForm((f) => ({
                    ...f,
                    plant_id: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              >
                <option value="">Unassigned</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="label">Status</label>
              <select className="input" value={newEquipForm.status} onChange={(e) => setNewEquipForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button onClick={handleCreateEquip} className="btn-primary">Save</button>
            <button onClick={() => setAddingEquip(false)} className="btn-secondary">Cancel</button>
          </div>
        )}

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Equipment Name</th>
                <th>Code</th>
                <th>Plant</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleEquipment.map((eq) => (
                <tr key={eq.id}>
                  {editingEquip === eq.id ? (
                    <>
                      <td><input type="text" className="input text-sm py-1" value={equipForm.name} onChange={(e) => setEquipForm((f) => ({ ...f, name: e.target.value }))} /></td>
                      <td><input type="text" className="input text-sm py-1 w-24" value={equipForm.code} onChange={(e) => setEquipForm((f) => ({ ...f, code: e.target.value }))} /></td>
                      <td>
                        <select
                          className="input text-sm py-1"
                          value={equipForm.plant_id ?? ''}
                          onChange={(e) =>
                            setEquipForm((f) => ({
                              ...f,
                              plant_id: e.target.value ? Number(e.target.value) : null,
                            }))
                          }
                        >
                          <option value="">Unassigned</option>
                          {plants.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select className="input text-sm py-1 w-24" value={equipForm.status} onChange={(e) => setEquipForm((f) => ({ ...f, status: e.target.value }))}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => handleUpdateEquip(eq.id)} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditingEquip(null)} className="text-gray-400"><X className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="font-medium">{eq.equipment_name}</td>
                      <td className="font-mono text-xs text-gray-500">{eq.equipment_code || '—'}</td>
                      <td className="text-gray-500">{eq.plant_name || '—'}</td>
                      <td>
                        <span className={`badge ${eq.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {eq.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingEquip(eq.id)
                              setEquipForm({
                                name: eq.equipment_name,
                                code: eq.equipment_code || '',
                                status: eq.status,
                                plant_id: eq.plant_id,
                              })
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          ><Pencil className="h-3.5 w-3.5" /></button>
                          <button
                            onClick={() => handleDeleteEquip(eq.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          ><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {visibleEquipment.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 py-8">
                    No equipment found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
