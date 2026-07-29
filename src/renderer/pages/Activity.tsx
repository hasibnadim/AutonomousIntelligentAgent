import { useEffect, useMemo, useState } from 'react'
import type { ActivityEntry } from '../types'
import { useAuth } from '../AuthContext'

function resultColor(result: string) {
  if (result === 'SUCCESS') return 'var(--hud-green)'
  if (result === 'NOT_FOUND') return 'var(--hud-amber)'
  return 'var(--hud-red)'
}

function matchesQuery(entry: ActivityEntry, q: string) {
  if (!q) return true
  const hay =
    `${entry.userId ?? ''} ${entry.userName} ${entry.action} ${entry.result} ${entry.detail}`.toLowerCase()
  return hay.includes(q)
}

export default function Activity() {
  const { user } = useAuth()
  const [rows, setRows] = useState<ActivityEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      // Fetch full recent log; filter locally so the search box never remounts / blurs.
      setRows(await window.api.activity.list(''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    void load()
    const off = window.api.activity.onNew((entry) => {
      setRows((prev) => [entry, ...prev].slice(0, 300))
    })
    return off
  }, [user?.role])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => matchesQuery(r, q))
  }, [rows, search])

  const stats = useMemo(() => {
    const success = filtered.filter((r) => r.result === 'SUCCESS' && r.action === 'GET').length
    const fail = filtered.filter((r) => r.result === 'FAIL' && r.action === 'GET').length
    return { success, fail, total: filtered.length }
  }, [filtered])

  if (user?.role !== 'ADMIN') {
    return (
      <p className="text-sm" style={{ color: 'var(--hud-red)' }}>
        Admin access required.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p
          className="text-[10px] font-mono tracking-[3px] uppercase mb-1"
          style={{ color: 'var(--accent-text-dim)' }}
        >
          Audit
        </p>
        <h1 className="text-lg font-mono tracking-wider" style={{ color: 'var(--accent)' }}>
          Activity Log
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Knock attempts — who, when, success or fail
        </p>
      </div>

      <div
        className="flex flex-wrap gap-3 items-center"
        style={{ WebkitAppRegion: 'no-drag' as unknown as string }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, id, action, result…"
          autoComplete="off"
          spellCheck={false}
          className="hud-input flex-1 min-w-[220px] px-3 py-2 text-sm"
          style={{
            WebkitAppRegion: 'no-drag' as unknown as string,
            pointerEvents: 'auto'
          }}
        />
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-2 text-[10px] font-mono tracking-wider uppercase"
          style={{
            border: '1px solid var(--accent-hover-border)',
            color: 'var(--accent)',
            background: 'var(--accent-bg-tile)',
            WebkitAppRegion: 'no-drag' as unknown as string
          }}
        >
          Refresh
        </button>
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
          GET ok {stats.success} · fail {stats.fail} · shown {stats.total}
        </span>
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--hud-red)' }}>
          {error}
        </p>
      )}

      <div style={{ border: '1px solid var(--accent-border-med)' }}>
        <div
          className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-mono tracking-wider uppercase"
          style={{
            background: 'var(--surface)',
            color: 'var(--accent-text-dim)',
            borderBottom: '1px solid var(--accent-border)'
          }}
        >
          <span className="col-span-2">When</span>
          <span className="col-span-2">User</span>
          <span className="col-span-1">Action</span>
          <span className="col-span-1">Result</span>
          <span className="col-span-6">Detail</span>
        </div>

        {loading ? (
          <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {search.trim()
              ? 'No matching activity.'
              : 'No activity yet. Knock attempts from ESP will appear here.'}
          </p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-12 gap-2 px-3 py-2 text-xs items-start"
              style={{ borderTop: '1px solid var(--accent-border)', color: 'var(--text)' }}
            >
              <span className="col-span-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                {new Date(row.createdAt).toLocaleString()}
              </span>
              <span className="col-span-2">
                <span className="font-mono" style={{ color: 'var(--accent)' }}>
                  #{row.userId ?? '—'}
                </span>{' '}
                {row.userName || '—'}
              </span>
              <span className="col-span-1 font-mono">{row.action}</span>
              <span className="col-span-1 font-mono" style={{ color: resultColor(row.result) }}>
                {row.result}
              </span>
              <span className="col-span-6 break-all" style={{ color: 'var(--text-secondary)' }}>
                {row.detail || '—'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
