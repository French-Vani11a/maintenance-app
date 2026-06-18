import { useEffect, useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { createUser, deleteUser, getUsers, updateUser } from '../services/api'
import type { User } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'

function roleLabel(role: string) {
  if (role === 'general') return 'General User'
  if (role === 'viewer') return 'Viewer'
  if (role === 'admin') return 'Admin'
  return role
}

export default function UsersManagement() {
  const { user: currentUser } = useAuth()
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })
  function askConfirm(title: string, message: string, onConfirm: () => void) {
    setConfirmDialog({ open: true, title, message, onConfirm })
  }
  function closeConfirm() { setConfirmDialog(s => ({ ...s, open: false })) }

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [error, setError] = useState('')

  // Create form
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'general' })

  // User detail modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [modalEditing, setModalEditing] = useState(false)
  const [modalError, setModalError] = useState('')
  const [editForm, setEditForm] = useState({ full_name: '', email: '', role: 'general', password: '' })

  async function loadUsers() {
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const created = await createUser({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      })
      setUsers((prev) => [...prev, created].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setForm({ full_name: '', email: '', password: '', role: 'general' })
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  function openModal(user: User) {
    setSelectedUser(user)
    setModalEditing(false)
    setModalError('')
    setEditForm({ full_name: user.full_name, email: user.username, role: user.role, password: '' })
  }

  function closeModal() {
    setSelectedUser(null)
    setModalEditing(false)
    setModalError('')
  }

  async function handleUpdateUser() {
    if (!selectedUser) return
    setModalError('')
    setUpdatingId(selectedUser.id)
    try {
      const updated = await updateUser(selectedUser.id, {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        password: editForm.password.trim() || undefined,
      })
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setSelectedUser(updated)
      setModalEditing(false)
    } catch (e: any) {
      setModalError(e?.response?.data?.detail || 'Failed to update user')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleToggleActive(user: User) {
    if (currentUser?.id === user.id) return
    setModalError('')
    setUpdatingId(user.id)
    try {
      const updated = await updateUser(user.id, { is_active: !user.is_active })
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setSelectedUser(updated)
    } catch (e: any) {
      setModalError(e?.response?.data?.detail || 'Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  function handleDeleteUser(user: User) {
    if (currentUser?.id === user.id) return
    askConfirm('Delete User', `Remove ${user.full_name} from the system? This cannot be undone.`, async () => {
      closeConfirm()
      setUpdatingId(user.id)
      try {
        await deleteUser(user.id)
        setUsers((prev) => prev.filter((x) => x.id !== user.id))
        closeModal()
      } catch (e: any) {
        setModalError(e?.response?.data?.detail || 'Failed to delete user')
      } finally {
        setUpdatingId(null)
      }
    })
  }

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
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Create user form */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800">Create User</h2>
        <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4" onSubmit={handleCreateUser}>
          <div>
            <label className="label">Full Name</label>
            <input className="input" type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} minLength={6} required />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="general">General User</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="md:col-span-4">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>

      {/* Users table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                onClick={() => openModal(user)}
              >
                <td className="font-medium">{user.full_name}</td>
                <td>{user.username}</td>
                <td className="capitalize">{roleLabel(user.role)}</td>
                <td>
                  <span className={`badge ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {user.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 py-8">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* User detail modal */}
      {selectedUser && (() => {
        const isProtectedAdmin = selectedUser.full_name.toLowerCase() === 'administrator'
        return (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={closeModal}
        >
          <div className="card w-full max-w-lg my-8 space-y-5" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{selectedUser.full_name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedUser.username}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!modalEditing && (
                  <>
                    <button
                      title="Edit"
                      onClick={() => setModalEditing(true)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!isProtectedAdmin && (
                      <button
                        title="Delete"
                        onClick={() => handleDeleteUser(selectedUser)}
                        disabled={currentUser?.id === selectedUser.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
                <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors ml-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {modalError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{modalError}</div>
            )}

            {modalEditing ? (
              <div className="space-y-4 border-t pt-4">
                {isProtectedAdmin ? (
                  /* Administrator — password only */
                  <div className="space-y-1">
                    <label className="label">New Password</label>
                    <input
                      className="input"
                      type="password"
                      value={editForm.password}
                      onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                      minLength={6}
                      placeholder="Enter new password"
                      autoFocus
                    />
                  </div>
                ) : (
                  /* Everyone else — all fields */
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="label">Full Name</label>
                      <input className="input" type="text" value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="label">Email</label>
                      <input className="input" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="label">Role</label>
                      <select className="input" value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                        <option value="general">General User</option>
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="label">New Password</label>
                      <input className="input" type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} minLength={6} placeholder="Leave blank to keep current" />
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={handleUpdateUser} disabled={updatingId === selectedUser.id} className="btn-primary flex items-center gap-1.5">
                    {updatingId === selectedUser.id ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                    {isProtectedAdmin ? 'Save Password' : 'Save Changes'}
                  </button>
                  <button onClick={() => { setModalEditing(false); setModalError('') }} className="btn-secondary">Cancel</button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="border-t pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role</p>
                    <p className="mt-1 text-sm text-gray-800">{roleLabel(selectedUser.role)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</p>
                    <span className={`mt-1 inline-flex badge ${selectedUser.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {selectedUser.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {!isProtectedAdmin && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleToggleActive(selectedUser)}
                      disabled={updatingId === selectedUser.id || currentUser?.id === selectedUser.id}
                      className="btn-secondary flex items-center gap-1.5"
                      title={currentUser?.id === selectedUser.id ? 'You cannot change your own status' : ''}
                    >
                      {updatingId === selectedUser.id ? <LoadingSpinner size="sm" /> : null}
                      {selectedUser.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
        )
      })()}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  )
}
