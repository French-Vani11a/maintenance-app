import { useState } from 'react'
import { changeMyPassword } from '../services/api'

export default function ChangePassword() {
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.new_password.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }
    if (form.new_password !== form.confirm_password) {
      setError('New password and confirmation do not match')
      return
    }

    setSaving(true)
    try {
      await changeMyPassword({
        current_password: form.current_password,
        new_password: form.new_password,
      })
      setForm({ current_password: '', new_password: '', confirm_password: '' })
      setSuccess('Password changed successfully')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700">Change Password</h2>
        <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3" onSubmit={handleSubmit}>
          <div>
            <label className="label">Current Password</label>
            <input
              className="input"
              type="password"
              value={form.current_password}
              onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              className="input"
              type="password"
              value={form.new_password}
              onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              className="input"
              type="password"
              value={form.confirm_password}
              onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
              minLength={6}
              required
            />
          </div>
          <div className="md:col-span-3">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Updating…' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
