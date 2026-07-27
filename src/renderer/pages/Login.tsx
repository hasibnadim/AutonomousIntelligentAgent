import { FormEvent, useState } from 'react'
import { useAuth } from '../AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm p-6 space-y-4"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--accent-border-med)'
        }}
      >
        <div>
          <p className="text-[10px] font-mono tracking-[3px] uppercase mb-1" style={{ color: 'var(--accent-text-dim)' }}>
            Access
          </p>
          <h1 className="text-lg font-mono tracking-wider" style={{ color: 'var(--accent)' }}>
            Sign In
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Admin only · default: admin / admin123
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--accent-text-muted)' }}>
            Username
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--accent-border-med)',
              color: 'var(--text)'
            }}
            autoFocus
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--accent-text-muted)' }}>
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--accent-border-med)',
              color: 'var(--text)'
            }}
            required
          />
        </label>

        {error && (
          <p className="text-xs" style={{ color: 'var(--hud-red)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2 text-xs font-mono tracking-wider uppercase transition-opacity disabled:opacity-50"
          style={{
            background: 'var(--accent-bg-tile)',
            border: '1px solid var(--accent-hover-border)',
            color: 'var(--accent)'
          }}
        >
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
