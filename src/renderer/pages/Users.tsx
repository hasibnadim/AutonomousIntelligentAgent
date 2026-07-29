import { FormEvent, useEffect, useState } from 'react'
import type { User } from '../types'
import { useAuth } from '../AuthContext'

const emptyForm = {
  userId: '',
  username: '',
  email: '',
  name: '',
  password: '',
  role: 'USER'
}

type Tab = 'USER' | 'ADMIN'

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('USER')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setUsers(await window.api.users.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const resetForm = () => {
    setForm({ ...emptyForm, role: tab })
    setEditingId(null)
  }

  const startEdit = (u: User) => {
    setEditingId(u.id)
    setForm({
      userId: String(u.id),
      username: u.username || '',
      email: u.email || '',
      name: u.name,
      password: '',
      role: u.role === 'ADMIN' ? 'ADMIN' : 'USER'
    })
  }

  const selectTab = (next: Tab) => {
    setTab(next)
    setEditingId(null)
    setForm({ ...emptyForm, role: next })
  }

  const visibleUsers = users.filter((u) =>
    tab === 'ADMIN' ? u.role === 'ADMIN' : u.role !== 'ADMIN'
  )
  const adminCount = users.filter((u) => u.role === 'ADMIN').length
  const userCount = users.length - adminCount
  const isAdminTab = tab === 'ADMIN'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const parsedUserId = form.userId.trim() ? Number(form.userId.trim()) : undefined
      if (form.userId.trim() && (!Number.isInteger(parsedUserId) || (parsedUserId ?? 0) <= 0)) {
        throw new Error('User ID must be a positive integer')
      }

      if (editingId == null) {
        await window.api.users.create(
          isAdminTab
            ? {
                userId: parsedUserId,
                username: form.username,
                email: form.email,
                name: form.name,
                password: form.password,
                role: 'ADMIN'
              }
            : {
                userId: parsedUserId,
                name: form.name,
                role: 'USER'
              }
        )
      } else if (isAdminTab) {
        await window.api.users.update({
          id: editingId,
          userId: parsedUserId,
          username: form.username,
          email: form.email,
          name: form.name,
          role: 'ADMIN',
          ...(form.password ? { password: form.password } : {})
        })
      } else {
        await window.api.users.update({
          id: editingId,
          userId: parsedUserId,
          name: form.name,
          role: 'USER'
        })
      }
      setForm({ ...emptyForm, role: tab })
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this user?')) return
    setError('')
    try {
      await window.api.users.delete(id)
      if (editingId === id) resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const onResetBio = async (id: number) => {
    if (!confirm('Reset biometric pattern? User will need to SET a new pattern on the keypad.')) return
    setError('')
    try {
      await window.api.users.resetBiometric(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    }
  }

  if (me?.role !== 'ADMIN') {
    return (
      <p className="text-sm" style={{ color: 'var(--hud-red)' }}>
        Admin access required.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-mono tracking-[3px] uppercase mb-1" style={{ color: 'var(--accent-text-dim)' }}>
          Administration
        </p>
        <h1 className="text-lg font-mono tracking-wider" style={{ color: 'var(--accent)' }}>
          Users
        </h1>
      </div>

      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--accent-border)' }}>
        {([
          ['USER', 'Users', userCount],
          ['ADMIN', 'Admins', adminCount]
        ] as const).map(([value, label, count]) => (
          <button
            key={value}
            onClick={() => selectTab(value)}
            className="px-4 py-2 text-[10px] font-mono tracking-wider uppercase transition-colors"
            style={{
              borderBottom: `2px solid ${tab === value ? 'var(--accent)' : 'transparent'}`,
              color: tab === value ? 'var(--accent)' : 'var(--accent-text-muted)',
              background: tab === value ? 'var(--accent-bg-tile)' : 'transparent'
            }}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--hud-red)' }}>
          {error}
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--accent-border-med)' }}
      >
        <p className="md:col-span-2 text-[10px] font-mono tracking-wider uppercase" style={{ color: 'var(--accent-text-muted)' }}>
          {editingId == null
            ? `Create ${isAdminTab ? 'admin' : 'keypad user'}`
            : `Edit #${editingId}`}
          {!isAdminTab && (
            <span className="ml-2 normal-case tracking-normal" style={{ color: 'var(--text-secondary)' }}>
              — no login; ESP32 uses numeric id + pattern
            </span>
          )}
        </p>

        <label className="block space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--accent-text-dim)' }}>
            User ID {isAdminTab ? '(optional)' : '(keypad id)'}
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={form.userId}
            onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
            placeholder={editingId == null ? 'auto' : String(editingId)}
            className="w-full px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--accent-border-med)',
              color: 'var(--text)'
            }}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--accent-text-dim)' }}>
            Name
          </span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--accent-border-med)',
              color: 'var(--text)'
            }}
            required
          />
        </label>

        {isAdminTab && (
          <>
            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--accent-text-dim)' }}>
                Username
              </span>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--accent-border-med)',
                  color: 'var(--text)'
                }}
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--accent-text-dim)' }}>
                Email
              </span>
              <input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--accent-border-med)',
                  color: 'var(--text)'
                }}
                required
              />
            </label>

            <label className="block space-y-1 md:col-span-2">
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--accent-text-dim)' }}>
                Password {editingId != null ? '(optional)' : ''}
              </span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--accent-border-med)',
                  color: 'var(--text)'
                }}
                required={editingId == null}
                minLength={editingId == null ? 6 : undefined}
              />
            </label>
          </>
        )}

        <div className="md:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-[10px] font-mono tracking-wider uppercase disabled:opacity-50"
            style={{
              border: '1px solid var(--accent-hover-border)',
              color: 'var(--accent)',
              background: 'var(--accent-bg-tile)'
            }}
          >
            {busy ? 'Saving…' : editingId == null ? 'Create' : 'Update'}
          </button>
          {editingId != null && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-[10px] font-mono tracking-wider uppercase"
              style={{ border: '1px solid var(--accent-border-med)', color: 'var(--accent-text-muted)' }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div style={{ border: '1px solid var(--accent-border-med)' }}>
        <div
          className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-mono tracking-wider uppercase"
          style={{ background: 'var(--surface)', color: 'var(--accent-text-dim)', borderBottom: '1px solid var(--accent-border)' }}
        >
          <span className="col-span-2">Id</span>
          <span className="col-span-3">Name</span>
          <span className="col-span-2">{isAdminTab ? 'Username' : 'Login'}</span>
          <span className="col-span-1">Bio</span>
          <span className="col-span-2">Created</span>
          <span className="col-span-2 text-right">Actions</span>
        </div>

        {loading ? (
          <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Loading…
          </p>
        ) : visibleUsers.length === 0 ? (
          <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {isAdminTab ? 'No admins yet.' : 'No users yet.'}
          </p>
        ) : (
          visibleUsers.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-12 gap-2 px-3 py-2 text-xs items-center"
              style={{ borderTop: '1px solid var(--accent-border)', color: 'var(--text)' }}
            >
              <span className="col-span-2 font-mono" style={{ color: 'var(--accent)' }}>
                #{u.id}
              </span>
              <span className="col-span-3 truncate">{u.name || '—'}</span>
              <span className="col-span-2 truncate" style={{ color: 'var(--text-secondary)' }}>
                {isAdminTab ? u.username || '—' : 'keypad only'}
              </span>
              <span
                className="col-span-1 font-mono"
                style={{ color: u.biometricStatus === 'GET' ? 'var(--hud-green)' : 'var(--hud-amber)' }}
              >
                {u.biometricStatus || 'SET'}
              </span>
              <span className="col-span-2" style={{ color: 'var(--text-secondary)' }}>
                {new Date(u.createdAt).toLocaleDateString()}
              </span>
              <span className="col-span-2 flex justify-end gap-1 flex-wrap">
                {u.biometricStatus === 'GET' && (
                  <button
                    onClick={() => onResetBio(u.id)}
                    className="px-2 py-1 text-[10px] font-mono uppercase"
                    style={{ border: '1px solid rgba(255,170,0,0.4)', color: 'var(--hud-amber)' }}
                    title="Clear pattern → SET"
                  >
                    Reset Bio
                  </button>
                )}
                <button
                  onClick={() => startEdit(u)}
                  className="px-2 py-1 text-[10px] font-mono uppercase"
                  style={{ border: '1px solid var(--accent-border-med)', color: 'var(--accent-text-muted)' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(u.id)}
                  disabled={u.id === me.id}
                  className="px-2 py-1 text-[10px] font-mono uppercase disabled:opacity-30"
                  style={{ border: '1px solid rgba(255,0,68,0.35)', color: 'var(--hud-red)' }}
                >
                  Delete
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
