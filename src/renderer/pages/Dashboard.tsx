import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import type { EspLogEntry, EspStatus } from '../types'

const emptyStatus: EspStatus = {
  listening: false,
  port: 9000,
  connected: false,
  clientCount: 0,
  clients: [],
  hosts: [],
  connectHint: '0.0.0.0:9000'
}

function logColor(type: EspLogEntry['type']) {
  if (type === 'rx') return 'var(--accent)'
  if (type === 'tx') return 'var(--hud-green)'
  if (type === 'error') return 'var(--hud-red)'
  return 'var(--text-secondary)'
}

export default function Dashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [status, setStatus] = useState<EspStatus>(emptyStatus)
  const [logs, setLogs] = useState<EspLogEntry[]>([])

  useEffect(() => {
    let alive = true

    const refresh = () => {
      window.api.esp.getStatus().then((s) => {
        if (alive) setStatus(s)
      })
      window.api.esp.getLogs().then((entries) => {
        if (alive) setLogs(entries)
      })
    }

    refresh()
    const timer = setInterval(() => {
      window.api.esp.getStatus().then((s) => {
        if (alive) setStatus(s)
      })
    }, 3000)

    const offStatus = window.api.esp.onStatus(setStatus)
    const offLog = window.api.esp.onLog((entry) => {
      setLogs((prev) => [entry, ...prev].slice(0, 200))
    })
    const offCleared = window.api.esp.onLogsCleared(() => setLogs([]))

    return () => {
      alive = false
      clearInterval(timer)
      offStatus()
      offLog()
      offCleared()
    }
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-mono tracking-[3px] uppercase mb-1" style={{ color: 'var(--accent-text-dim)' }}>
          Overview
        </p>
        <h1 className="text-lg font-mono tracking-wider" style={{ color: 'var(--accent)' }}>
          Dashboard
        </h1>
      </div>

      <div
        className="p-5 space-y-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--accent-border-med)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          Signed in as <span style={{ color: 'var(--accent)' }}>{user?.username}</span>
          {user?.name ? ` (${user.name})` : ''}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Admin console · keypad users use ESP32 TCP :9000 (id + pattern, no login)
        </p>

        <div className="flex gap-3 pt-2">
          {isAdmin && (
            <Link
              to="/users"
              className="px-3 py-2 text-[10px] font-mono tracking-wider uppercase"
              style={{
                border: '1px solid var(--accent-hover-border)',
                color: 'var(--accent)',
                background: 'var(--accent-bg-tile)'
              }}
            >
              Manage Users
            </Link>
          )}
          <Link
            to="/profile"
            className="px-3 py-2 text-[10px] font-mono tracking-wider uppercase"
            style={{
              border: '1px solid var(--accent-border-med)',
              color: 'var(--accent-text-muted)'
            }}
          >
            My Profile
          </Link>
        </div>
      </div>

      <div
        className="p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--accent-border-med)' }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-mono tracking-[3px] uppercase mb-1" style={{ color: 'var(--accent-text-dim)' }}>
              ESP32 Link
            </p>
            <h2 className="text-sm font-mono tracking-wider" style={{ color: 'var(--accent)' }}>
              TCP :{status.port}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs font-mono">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{
                  background: status.connected ? 'var(--hud-green)' : 'var(--hud-red)',
                  boxShadow: status.connected
                    ? '0 0 8px var(--hud-green)'
                    : '0 0 8px rgba(255,0,68,0.5)'
                }}
              />
              <span style={{ color: status.connected ? 'var(--hud-green)' : 'var(--hud-red)' }}>
                {status.connected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
              {status.listening ? 'server up' : 'server down'} · {status.clientCount} client
              {status.clientCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {status.hosts.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-mono tracking-wider uppercase" style={{ color: 'var(--accent-text-dim)' }}>
              ESP should connect to (host hotspot / LAN IP)
            </p>
            <p className="text-sm font-mono" style={{ color: 'var(--hud-green)' }}>
              {status.connectHint}
            </p>
            <div className="space-y-0.5">
              {status.hosts.map((h) => (
                <p key={h.endpoint + h.name} className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {h.endpoint}
                  <span style={{ color: 'var(--accent-text-dim)' }}> · {h.name}</span>
                </p>
              ))}
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Join ESP32 to this PC&apos;s hotspot, then open a TCP client to the IP above on port {status.port}.
              Allow Windows Firewall for private networks if it asks.
            </p>
          </div>
        )}

        {status.clients.length > 0 && (
          <p className="text-[10px] font-mono" style={{ color: 'var(--accent-text-muted)' }}>
            Clients: {status.clients.join(' · ')}
          </p>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono tracking-wider uppercase" style={{ color: 'var(--accent-text-dim)' }}>
            Live traffic log
          </p>
          <button
            onClick={() => window.api.esp.clearLogs()}
            className="px-2 py-1 text-[10px] font-mono uppercase"
            style={{ border: '1px solid var(--accent-border-med)', color: 'var(--accent-text-muted)' }}
          >
            Clear
          </button>
        </div>

        <div
          className="h-64 overflow-auto font-mono text-[11px]"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--accent-border)',
            padding: '8px 10px'
          }}
        >
          {logs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Waiting for ESP32 traffic on :9000…</p>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className="py-0.5 break-all" style={{ color: logColor(entry.type) }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {new Date(entry.time).toLocaleTimeString()}
                </span>
                {' '}
                <span style={{ color: 'var(--accent-text-dim)' }}>[{entry.type.toUpperCase()}]</span>
                {' '}
                <span style={{ color: 'var(--text-secondary)' }}>{entry.remote}</span>
                {' '}
                {entry.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
