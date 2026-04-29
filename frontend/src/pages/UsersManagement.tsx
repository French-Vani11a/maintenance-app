import { useEffect, useState } from 'react'
import { createUser, deleteUser, getUsers, updateUser } from '../services/api'
import type { User } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'

export default function UsersManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    role: 'general',
    password: '',
  })

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'general',
  })

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

  useEffect(() => {
    loadUsers()
  }, [])

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

  function startEdit(user: User) {
    setEditingUserId(user.id)
    setEditForm({
      full_name: user.full_name,
      email: user.username,
      role: user.role,
      password: '',
    })
  }

  function cancelEdit() {
    setEditingUserId(null)
    setEditForm({ full_name: '', email: '', role: 'general', password: '' })
  }

  async function handleUpdateUser(userId: number) {
    setError('')
    setUpdatingId(userId)
    try {
      const updated = await updateUser(userId, {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        password: editForm.password.trim() || undefined,
      })
      setUsers((prev) =>
        prev
          .map((x) => (x.id === userId ? updated : x))
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
      )
      cancelEdit()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to update user')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleToggleActive(user: User) {
    if (currentUser?.id === user.id) return
    setError('')
    setUpdatingId(user.id)
    try {
      const updated = await updateUser(user.id, { is_active: !user.is_active })
      setUsers((prev) =>
        prev
          .map((x) => (x.id === user.id ? updated : x))
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
      )
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDeleteUser(user: User) {
    if (currentUser?.id === user.id) return
    if (!confirm(`Delete user ${user.full_name}?`)) return

    setError('')
    setUpdatingId(user.id)
    try {
      await deleteUser(user.id)
      setUsers((prev) => prev.filter((x) => x.id !== user.id))
      if (editingUserId === user.id) {
        cancelEdit()
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete user')
    } finally {
      setUpdatingId(null)
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
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="card">
        <h2 className="text-base font-semibold text-gray-800">Create User</h2>
        <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4" onSubmit={handleCreateUser}>
          <div>
            <label className="label">Full Name</label>
            <input
              className="input"
              type="text"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="general">General User</option>
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

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Password Reset</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                {editingUserId === user.id ? (
                  <>
                    <td>
                      <input
                        className="input text-sm py-1"
                        type="text"
                        value={editForm.full_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        className="input text-sm py-1"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </td>
                    <td>
                      <select
                        className="input text-sm py-1"
                        value={editForm.role}
                        onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                      >
                        <option value="general">General User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="input text-sm py-1"
                        type="password"
                        value={editForm.password}
                        onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                        minLength={6}
                        placeholder="New password (optional)"
                      />
                    </td>
                    <td>
                      <span className={`badge ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {user.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => handleUpdateUser(user.id)}
                          disabled={updatingId === user.id}
                        >
                          Save
                        </button>
                        <button className="btn-secondary btn-sm" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="font-medium">{user.full_name}</td>
                    <td>{user.username}</td>
                    <td className="capitalize">{user.role === 'general' ? 'General User' : user.role}</td>
                    <td className="text-gray-400">••••••</td>
                    <td>
                      <span className={`badge ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {user.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button className="btn-secondary btn-sm" onClick={() => startEdit(user)}>
                          Edit
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => handleToggleActive(user)}
                          disabled={updatingId === user.id || currentUser?.id === user.id}
                          title={currentUser?.id === user.id ? 'You cannot deactivate your own account' : ''}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => handleDeleteUser(user)}
                          disabled={updatingId === user.id || currentUser?.id === user.id}
                          title={currentUser?.id === user.id ? 'You cannot delete your own account' : ''}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-8">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
