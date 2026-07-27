import { FormEvent, useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'

export default function Profile() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({
    username: '',
    email: '',
    name: '',
    password: ''
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm({
      username: user.username || '',
      email: user.email || '',
      name: user.name,
      password: ''
    })
  }, [user])

  if (!user) return null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const updated = await window.api.users.update({
        id: user.id,
        username: form.username,
        email: form.email,
        name: form.name,
        ...(form.password ? { password: form.password } : {})
      })
      setUser(updated)
      setForm((f) => ({ ...f, password: '' }))
      setMessage('Profile updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <p className="text-[10px] font-mono tracking-[3px] uppercase mb-1" style={{ color: 'var(--accent-text-dim)' }}>
          Account
        </p>
        <h1 className="text-lg font-mono tracking-wider" style={{ color: 'var(--accent)' }}>
          My Profile
        </h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="p-4 space-y-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--accent-border-med)' }}
      >
        {(['username', 'email', 'name'] as const).map((field) => (
          <label key={field} className="block space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--accent-text-dim)' }}>
              {field}
            </span>
            <input
              value={form[field]}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="w-full px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--accent-border-med)',
                color: 'var(--text)'
              }}
              required={field !== 'name'}
            />
          </label>
        ))}

        <label className="block space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--accent-text-dim)' }}>
            New password (optional)
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
            minLength={6}
          />
        </label>

        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Role: {user.role} (managed by admin)
        </p>

        {error && (
          <p className="text-xs" style={{ color: 'var(--hud-red)' }}>
            {error}
          </p>
        )}
        {message && (
          <p className="text-xs" style={{ color: 'var(--hud-green)' }}>
            {message}
          </p>
        )}

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
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
