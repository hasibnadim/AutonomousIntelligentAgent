import { useEffect, useState, useCallback, useRef } from 'react'
import type { Telemetry, CommandLog, Waypoint } from '../types'

export default function Map() {
  const [t, setT] = useState<Telemetry | null>(null)
  const [log, setLog] = useState<CommandLog[]>([])
  const [wpts, setWpts] = useState<Waypoint[]>([])
  const [cmd, setCmd] = useState('')
  const [usPoints, setUsPoints] = useState<{lat: number; lng: number; color: string}[]>([])
  const mapRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    try {
      const tel = await window.api.getTelemetry()
      setT(tel)
    } catch { setT(null) }
    try {
      const cl = await window.api.getCommandLog()
      setLog(cl)
    } catch { setLog([]) }
    try {
      const wp = await window.api.getWaypoints()
      setWpts(wp)
    } catch { setWpts([]) }
  }, [])

  useEffect(() => {
    refresh()
    const iv = setInterval(refresh, 1000)
    return () => clearInterval(iv)
  }, [refresh])

  useEffect(() => {
    if (!t) return
    const d = t.ultrasonicDistance
    const color = d > 60 ? '#00ff88' : d > 30 ? '#ffaa00' : '#ff0044'
    const angleRad = t.heading * Math.PI / 180
    const distDeg = d / 100 / 111000
    const lat = t.latitude + distDeg * Math.cos(angleRad)
    const lng = t.longitude + distDeg * Math.sin(angleRad) / Math.cos(t.latitude * Math.PI / 180)
    setUsPoints(prev => [...prev.slice(-800), { lat, lng, color }])
  }, [t])

  const send = useCallback(async (c: string) => {
    await window.api.sendCommand(c)
    refresh()
  }, [refresh])

  const addWpt = useCallback(async () => {
    if (!t) return
    const label = `WP-${wpts.length + 1}`
    await window.api.addWaypoint({ lat: t.latitude, lng: t.longitude, label })
    refresh()
  }, [t, wpts, refresh])

  const delWpt = useCallback(async (id: number) => {
    await window.api.deleteWaypoint(id)
    refresh()
  }, [refresh])

  const navToWpt = useCallback(async (lat: number, lng: number) => {
    await window.api.sendCommand(`goto:${lat}:${lng}`)
    refresh()
  }, [refresh])

  const clearMap = useCallback(() => setUsPoints([]), [])

  const handleNavigate = useCallback(async (deg: number, thr: number) => {
    await Promise.all([
      window.api.sendCommand(`heading:${deg.toFixed(1)}`),
      window.api.sendCommand(`throttle:${thr.toFixed(2)}`)
    ])
    refresh()
  }, [refresh])

  const handleCustom = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cmd.trim()) return
    await window.api.sendCommand(cmd.trim())
    setCmd('')
    refresh()
  }, [cmd, refresh])

  if (!t) return <div className="flex items-center justify-center h-64 font-mono text-sm" style={{ color: 'var(--accent-text-faint)' }}>Acquiring satellite link...</div>

  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="hud-title text-xs tracking-[4px]">Tactical Display</span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--accent-text-faint)' }}>|</span>
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-wider" style={{ color: 'var(--accent-text-muted)' }}>MODE</span>
            <span className={`text-[10px] font-mono tracking-wider ${t.mode === 'autonomous' ? 'hud-glow-green' : 'hud-glow-amber'}`} style={{ color: t.mode === 'autonomous' ? '#00ff88' : '#ffaa00' }}>
              {t.mode.toUpperCase()}
            </span>
          </span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--accent-text-faint)' }}>|</span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--accent-text-muted)' }}>TGT</span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--accent)', textShadow: '0 0 8px var(--accent-text-muted)' }}>
            {t.targetLat.toFixed(4)}, {t.targetLng.toFixed(4)}
          </span>
        </div>
        <span className="text-[10px] font-mono animate-data-blink" style={{ color: 'var(--accent-text-faint)' }}>
          SAT: 8 · HDOP: 1.2
        </span>
      </div>

      {/* ── Main: Map + Sidebar ── */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* SVG Tactical Map */}
        <div className="flex-1 hud-panel p-0 overflow-hidden">
          <MapView telemetry={t} waypoints={wpts} usPoints={usPoints} onMapClick={(lat, lng) => send(`goto:${lat}:${lng}`)} />
          <span className="corner-bl">└</span>
          <span className="corner-br">┘</span>
        </div>

        {/* Right sidebar: Steering + Commands + Waypoints */}
        <div className="w-56 shrink-0 flex flex-col gap-4">
          {/* Steering Wheel */}
          <div className="hud-panel p-0">
            <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--accent-border)' }}>
              <span className="hud-title text-[9px]">Steering</span>
            </div>
            <div className="p-3 flex justify-center">
              <SteeringWheel heading={t.heading} throttle={t.speed} onNavigate={handleNavigate} onStop={() => send('stop')} />
            </div>
            <span className="corner-bl">└</span>
            <span className="corner-br">┘</span>
          </div>

          {/* Action buttons */}
          <div className="hud-panel p-0">
            <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--accent-border)' }}>
              <span className="hud-title text-[9px]">Commands</span>
            </div>
            <div className="p-3 flex flex-wrap gap-1.5">
              <HudBtn label="AUTO" cmd="mode_auto" active={t.mode === 'autonomous'} color="green" onClick={send} />
              <HudBtn label="MANUAL" cmd="mode_manual" active={t.mode === 'manual'} color="amber" onClick={send} />
              <span className="w-px self-stretch" style={{ background: 'var(--accent-border-subtle)' }} />
              <HudBtn label="START" cmd="start" color="green" onClick={send} />
              <HudBtn label="STOP" cmd="stop" color="amber" onClick={send} />
              <HudBtn label="E-STOP" cmd="emergency" color="red" onClick={send} />
              <span className="w-px self-stretch" style={{ background: 'var(--accent-border-subtle)' }} />
              <HudBtn label="HOME" cmd="home" color="cyan" onClick={send} />
              <HudBtn label="+ WP" cmd="" color="cyan" onClick={() => addWpt()} />
              <span className="w-px self-stretch" style={{ background: 'var(--accent-border-subtle)' }} />
              <button onClick={clearMap} className="hud-btn px-2 py-1.5 text-[9px] border tracking-[2px] transition-all duration-150"
                style={{ borderColor: 'var(--accent-text-dim)', color: 'var(--accent-text-muted)' }}>
                CLEAR MAP
              </button>
            </div>
            <span className="corner-bl">└</span>
            <span className="corner-br">┘</span>
          </div>

          {/* Waypoints */}
          {wpts.length > 0 && (
            <div className="hud-panel p-0 flex-1 overflow-hidden flex flex-col">
              <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--accent-border)' }}>
                <span className="hud-title text-[9px]">Waypoints [{wpts.length}]</span>
              </div>
              <div className="p-1.5 space-y-0.5 overflow-y-auto flex-1">
                {wpts.map((w) => (
                  <div key={w.id} className="flex items-center gap-2 px-2 py-1" style={{ borderBottom: '1px solid var(--accent-bg-tile)' }}>
                    <span className="text-[10px] font-mono truncate" style={{ color: 'var(--accent-text-title)' }}>{w.label}</span>
                    <span className="text-[10px] font-mono truncate shrink-0" style={{ color: 'var(--accent-text-muted)' }}>{w.lat.toFixed(4)}, {w.lng.toFixed(4)}</span>
                    <button onClick={() => navToWpt(w.lat, w.lng)} className="hud-btn ml-auto px-1.5 py-0.5 text-[8px] border shrink-0" style={{ borderColor: 'var(--accent-text-dim)', color: 'var(--accent-text-title)' }}>
                      NAV
                    </button>
                    <button onClick={() => delWpt(w.id)} className="hud-btn px-1.5 py-0.5 text-[8px] border shrink-0" style={{ borderColor: 'rgba(255,0,68,0.2)', color: 'rgba(255,0,68,0.5)' }}>
                      DEL
                    </button>
                  </div>
                ))}
              </div>
              <span className="corner-bl">└</span>
              <span className="corner-br">┘</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Terminal ── */}
      <div className="hud-panel p-0 shrink-0 max-h-[200px] flex flex-col">
        <div className="px-4 py-2.5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--accent-border)' }}>
          <span className="hud-title">Command Terminal</span>
          <span className="text-[9px] font-mono" style={{ color: 'var(--accent-text-very-dim)' }}>stdin &gt;</span>
        </div>
        <div className="p-4 space-y-3 flex-1 min-h-0 flex flex-col">
          <form onSubmit={handleCustom} className="flex gap-2 shrink-0">
            <input
              type="text"
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              placeholder="ENTER COMMAND..."
              className="hud-input flex-1 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="hud-btn px-5 py-2 text-xs tracking-[2px] shrink-0"
              style={{ background: 'var(--accent-bg-hover)', border: '1px solid var(--accent-text-very-dim)', color: 'var(--accent)' }}
            >
              EXEC
            </button>
          </form>
          <div className="space-y-0.5 overflow-y-auto font-mono text-[11px] pl-1 flex-1 min-h-0" style={{ borderLeft: '1px solid var(--accent-border-subtle)' }}>
            {log.length === 0 && <p style={{ color: 'var(--accent-text-very-dim)' }}>awaiting input...</p>}
            {log.map((e, i) => (
              <div key={i} className="flex gap-2.5 py-0.5">
                <span style={{ color: 'var(--accent-text-very-dim)' }} className="shrink-0 w-14">{e.time}</span>
                <span style={{ color: 'var(--accent-text-title)' }} className="shrink-0">{'▸'}</span>
                <span style={{ color: e.command === 'emergency' ? '#ff0044' : 'var(--accent)' }}>{e.command}</span>
                <span style={{ color: 'var(--accent-text-faint)' }}>— {e.result}</span>
              </div>
            ))}
          </div>
        </div>
        <span className="corner-bl">└</span>
        <span className="corner-br">┘</span>
      </div>
    </div>
  )
}

/* ── SVG Tactical Map ── */
function MapView({ telemetry, waypoints, usPoints, onMapClick }: {
  telemetry: Telemetry
  waypoints: Waypoint[]
  usPoints: {lat: number; lng: number; color: string}[]
  onMapClick: (lat: number, lng: number) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pan = useRef({ x: 0, y: 0 })
  const zoom = useRef(6000)
  const refLat = 23.8103
  const refLng = 90.4125

  const toX = (lng: number) => 200 + (lng - refLng) * zoom.current + pan.current.x
  const toY = (lat: number) => 150 - (lat - refLat) * zoom.current + pan.current.y

  const cx = toX(telemetry.longitude)
  const cy = toY(telemetry.latitude)
  const angle = telemetry.heading * Math.PI / 180
  const hx = cx + Math.sin(angle) * 35
  const hy = cy - Math.cos(angle) * 35

  const [usMarks, setUsMarks] = useState<{x:number;y:number;color:string;life:number}[]>([])

  useEffect(() => {
    const d = telemetry.ultrasonicDistance
    const color = d > 60 ? '#00ff88' : d > 30 ? '#ffaa00' : '#ff0044'
    const coneLen = 45
    const bx = cx + (Math.min(d, 180) / 180) * coneLen * Math.sin(angle)
    const by = cy - (Math.min(d, 180) / 180) * coneLen * Math.cos(angle)
    setUsMarks(prev => {
      const next = [...prev, { x: bx, y: by, color, life: 0 }]
      return next.map(m => ({ ...m, life: m.life + 1 })).filter(m => m.life < 15)
    })
  }, [telemetry.ultrasonicDistance, telemetry.heading, telemetry.latitude, telemetry.longitude, cx, cy, angle])

  const handleClick: React.MouseEventHandler<SVGSVGElement> = (e) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    const lng = refLng + (mx - 200 - pan.current.x) / zoom.current
    const lat = refLat - (my - 150 - pan.current.y) / zoom.current
    onMapClick(lat, lng)
  }

      // ── Temperature heatmap color ──
      const heatTemp = telemetry.temperature
      const heatColor = heatTemp > 45 ? '#ff0044' : heatTemp > 38 ? '#ffaa00' : '#00ff88'

      return (
        <svg
          ref={svgRef}
          viewBox="0 0 400 300"
          className="w-full h-full cursor-crosshair data-flicker"
          onClick={handleClick}
          style={{ background: 'var(--bg)', '--heat-color': heatColor } as React.CSSProperties}
    >
      <defs>
        <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,240,255,0.03)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="heat-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--heat-color)" stopOpacity="0.25" />
          <stop offset="50%" stopColor="var(--heat-color)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--heat-color)" stopOpacity="0" />
        </radialGradient>
        <filter id="map-blur"><feGaussianBlur stdDeviation="1" /></filter>
        <filter id="heat-blur"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>

      {/* Background glow */}
      <rect width="400" height="300" fill="url(#map-glow)" />

      {/* Hex grid */}
      {Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (
        <polygon key={`h${r}-${c}`}
          points={hexPoints(25 + c * 50 + (r % 2) * 25, 15 + r * 40)}
          fill="none" stroke="rgba(0,240,255,0.04)" strokeWidth="0.5"
        />
      )))}

      {/* ── Persistent ultrasonic obstacle map ── */}
      {usPoints.map((p, i) => {
        const px = toX(p.lng)
        const py = toY(p.lat)
        return (
          <circle key={i} cx={px} cy={py} r={2} fill={p.color} opacity={0.6} />
        )
      })}

      {/* ── Temperature heatmap ── */}
      <circle cx={cx} cy={cy} r={50} fill={heatColor} opacity={Math.min(0.12, (heatTemp - 20) / 200)} filter="url(#heat-blur)" />
      <circle cx={cx} cy={cy} r={30} fill={heatColor} opacity={Math.min(0.2, (heatTemp - 20) / 120)} />

      {/* ── Ultrasonic cone ── */}
      {(() => {
        const usDist = telemetry.ultrasonicDistance
        const usColor = usDist > 60 ? '#00ff88' : usDist > 30 ? '#ffaa00' : '#ff0044'
        const coneHalf = 15 * Math.PI / 180
        const coneLen = 45
        const clx = cx + coneLen * Math.sin(angle - coneHalf)
        const cly = cy - coneLen * Math.cos(angle - coneHalf)
        const crx = cx + coneLen * Math.sin(angle + coneHalf)
        const cry = cy - coneLen * Math.cos(angle + coneHalf)

        return (
          <>
            {/* Cone fill */}
            <path d={`M${cx},${cy} L${clx},${cly} A${coneLen},${coneLen} 0 0,1 ${crx},${cry} Z`} fill={usColor} opacity="0.06" />
            {/* Cone outline */}
            <path d={`M${cx},${cy} L${clx},${cly} A${coneLen},${coneLen} 0 0,1 ${crx},${cry} Z`} fill="none" stroke={usColor} strokeWidth="0.5" opacity="0.35" strokeDasharray="2 2" />
            {/* Zone arcs */}
            {[0.33, 0.66].map(t => {
              const r2 = coneLen * t
              const z1x = cx + r2 * Math.sin(angle - coneHalf)
              const z1y = cy - r2 * Math.cos(angle - coneHalf)
              const z2x = cx + r2 * Math.sin(angle + coneHalf)
              const z2y = cy - r2 * Math.cos(angle + coneHalf)
              return (
                <path key={t} d={`M${z1x},${z1y} A${r2},${r2} 0 0,1 ${z2x},${z2y}`} fill="none" stroke={usColor} strokeWidth="0.3" opacity="0.15" />
              )
            })}
            {/* Distance label at cone tip */}
            <text x={cx + (coneLen + 8) * Math.sin(angle)} y={cy - (coneLen + 8) * Math.cos(angle) + 3}
              textAnchor="middle" fill={usColor} fontSize={7} fontFamily="monospace" opacity="0.7">
              {usDist.toFixed(0)}cm
            </text>
          </>
        )
      })()}

      {/* ── Ultrasonic persistence marks ── */}
      {usMarks.map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r={2} fill={m.color} opacity={Math.max(0.05, 1 - m.life / 15) * 0.6} />
      ))}

      {/* ── Flame indicator ── */}
      {telemetry.flameDetected && (
        <g>
          <circle cx={cx - 22} cy={cy - 18} r={14} fill="#ff0044" opacity="0.12">
            <animate attributeName="opacity" values="0.12;0.28;0.12" dur="0.8s" repeatCount="indefinite" />
          </circle>
          <text x={cx - 22} y={cy - 13} textAnchor="middle" fill="#ff0044" fontSize={14} fontWeight="bold"
            style={{ filter: 'drop-shadow(0 0 4px #ff0044)' }}>
            <animate attributeName="opacity" values="0.9;0.3;0.9" dur="0.8s" repeatCount="indefinite" />
            ⟡
          </text>
          <text x={cx - 22} y={cy - 26} textAnchor="middle" fill="#ff0044" fontSize={6} fontFamily="monospace" opacity="0.8">FIRE</text>
        </g>
      )}

      {/* Range rings */}
      {[40, 80, 120].map((r) => (
        <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,240,255,0.06)" strokeWidth="0.5" strokeDasharray="3 3" />
      ))}

      {/* Crosshairs */}
      <line x1={cx - 20} y1={cy} x2={cx + 20} y2={cy} stroke="rgba(0,240,255,0.1)" strokeWidth="0.5" />
      <line x1={cx} y1={cy - 20} x2={cx} y2={cy + 20} stroke="rgba(0,240,255,0.1)" strokeWidth="0.5" />

      {/* Waypoints */}
      {waypoints.map((w) => (
        <g key={w.id}>
          <circle cx={toX(w.lng)} cy={toY(w.lat)} r={4} fill="none" stroke="#ffaa00" strokeWidth={1.5} opacity={0.8} />
          <circle cx={toX(w.lng)} cy={toY(w.lat)} r={8} fill="none" stroke="#ffaa00" strokeWidth={0.5} opacity={0.3}>
            <animate attributeName="r" values="4;12;4" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
          <text x={toX(w.lng) + 8} y={toY(w.lat) + 3} fill="#ffaa00" fontSize={9} fontFamily="monospace" opacity={0.8}>{w.label}</text>
        </g>
      ))}

      {/* Target indicator */}
      <circle cx={cx} cy={cy} r={10} fill="none" stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />

      {/* Heading line */}
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="var(--accent)" strokeWidth={1.5} opacity={0.7} />

      {/* Vehicle shape (diamond) */}
      <polygon
        points={`${cx},${cy - 8} ${cx + 6},${cy} ${cx},${cy + 8} ${cx - 6},${cy}`}
        fill="#00ff88"
        opacity={0.9}
        stroke="#00ff88"
        strokeWidth={1}
        filter="url(#map-blur)"
      />
      <polygon
        points={`${cx},${cy - 8} ${cx + 6},${cy} ${cx},${cy + 8} ${cx - 6},${cy}`}
        fill="#00ff88"
        opacity={0.9}
      />
      <text x={cx + 10} y={cy + 4} fill="#00ff88" fontSize={9} fontFamily="monospace" opacity={0.9}>V</text>

      {/* Compass */}
      <g transform="translate(365, 22)">
        <circle r={16} fill="none" stroke="var(--accent-border-med)" strokeWidth={0.5} />
        <text x={0} y={-10} textAnchor="middle" fill="var(--accent-text-muted)" fontSize={7} fontFamily="monospace">N</text>
        <line x1={0} y1={-12} x2={0} y2={12} stroke="var(--accent-border-subtle)" strokeWidth={0.3} />
        <line x1={-12} y1={0} x2={12} y2={0} stroke="var(--accent-border-subtle)" strokeWidth={0.3} />
      </g>

      {/* Home base */}
      <g transform={`translate(${toX(refLng)}, ${toY(refLat)})`}>
        <text x={-7} y={-7} fontSize={13} opacity={0.7}>⟐</text>
      </g>

      {/* Scan line animation overlay */}
      <rect x="0" y="0" width="400" height="2" fill="rgba(0,240,255,0.04)">
        <animate attributeName="y" from="0" to="300" dur="4s" repeatCount="indefinite" />
      </rect>

      {/* Bottom HUD text */}
      <text x="10" y="290" fill="var(--accent-text-very-dim)" fontSize={8} fontFamily="monospace">
        ZM: 1x · HDG: {telemetry.heading.toFixed(0)}° · SPD: {telemetry.speed.toFixed(2)} m/s · TMP: {telemetry.temperature.toFixed(1)}°C · US: {telemetry.ultrasonicDistance.toFixed(0)}cm
      </text>
      <text x="390" y="290" textAnchor="end" fill="var(--accent-text-very-dim)" fontSize={8} fontFamily="monospace">
        {new Date().toLocaleTimeString()} Z
      </text>
    </svg>
  )
}

/* ── Helpers ── */

function hexPoints(cx: number, cy: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    pts.push(`${cx + 14 * Math.cos(a)},${cy + 14 * Math.sin(a)}`)
  }
  return pts.join(' ')
}

function DirBtn({ label, cmd, onClick, color }: { label: string; cmd: string; onClick: (c: string) => void; color?: string }) {
  const bg = color === 'red'
    ? '!text-[#ff0044] !border-[rgba(255,0,68,0.3)] hover:!bg-[rgba(255,0,68,0.15)]'
    : ''
  return (
    <button
      onClick={() => onClick(cmd)}
      className={`w-10 h-10 flex items-center justify-center text-sm font-mono border transition-all duration-150 hud-btn ${bg || 'border-[var(--accent-border-med)] text-[var(--accent-text-muted)] hover:border-[var(--accent-hover-border)] hover:text-[var(--accent)] hover:bg-[var(--accent-bg-hover)]'}`}
    >
      {label}
    </button>
  )
}

function HudBtn({ label, cmd, color, active, onClick }: {
  label: string; cmd: string; color: string; active?: boolean; onClick: (c: string) => void
}) {
  const map: Record<string, string> = {
    green: 'rgba(0,255,136,0.15) rgba(0,255,136,0.3) #00ff88',
    amber: 'rgba(255,170,0,0.15) rgba(255,170,0,0.3) #ffaa00',
    red: 'rgba(255,0,68,0.15) rgba(255,0,68,0.3) #ff0044',
    cyan: 'var(--accent-bg-hover) var(--accent-text-dim) var(--accent)',
  }
  const [bg, border, text] = (map[color] || map.cyan).split(' ')
  return (
    <button
      onClick={() => onClick(cmd)}
      className="hud-btn px-3 py-1.5 text-[9px] border tracking-[2px] transition-all duration-150"
      style={{
        background: active ? bg : 'transparent',
        borderColor: active ? border : 'var(--btn-default-border)',
        color: active ? text : 'var(--btn-default-text)',
        boxShadow: active ? `0 0 10px ${bg}` : 'none'
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = text } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--btn-default-border)'; e.currentTarget.style.color = 'var(--btn-default-text)' } }}
    >
      {label}
    </button>
  )
}

/* ── Steering Wheel ── */
function SteeringWheel({ heading, throttle, onNavigate, onStop }: {
  heading: number
  throttle: number
  onNavigate: (deg: number, thr: number) => void
  onStop: () => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const size = 132, cx = size / 2, cy = size / 2, outerR = 52, innerR = 38

  const angleRad = (heading - 90) * Math.PI / 180
  const knobDist = innerR + throttle * (outerR - innerR)
  const knobX = cx + knobDist * Math.cos(angleRad)
  const knobY = cy + knobDist * Math.sin(angleRad)

  const handleMouseDown = (e: React.MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - rect.left - cx
      const dy = me.clientY - rect.top - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 10) return
      const svgAngle = Math.atan2(dy, dx) * 180 / Math.PI
      const compass = (svgAngle + 90 + 360) % 360
      const thr = Math.min(1, (dist - innerR) / (outerR - innerR))
      onNavigate(compass, thr)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const speedPct = Math.round(Math.abs(throttle) * 100)

  return (
    <svg ref={svgRef} width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      className="cursor-pointer select-none" onMouseDown={handleMouseDown} style={{ touchAction: 'none' }}>
      {/* Speed arc */}
      {throttle > 0.01 && (
        <path d={`M${cx},${cy - innerR} A${innerR},${innerR} 0 0,1 ${cx},${cy + innerR}`}
          fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.5"
          strokeDasharray={`${speedPct} ${100 - speedPct}`} strokeLinecap="round" />
      )}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="var(--accent-border-med)" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="var(--accent-border-subtle)" strokeWidth="0.5" strokeDasharray="2 2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
        const rad = (deg - 90) * Math.PI / 180
        return <line key={deg} x1={cx + (outerR - 5) * Math.cos(rad)} y1={cy + (outerR - 5) * Math.sin(rad)}
          x2={cx + outerR * Math.cos(rad)} y2={cy + outerR * Math.sin(rad)}
          stroke="var(--accent-text-muted)" strokeWidth="0.8" />
      })}
      <text x={cx} y={cy - outerR - 5} textAnchor="middle" fill="var(--accent-text-muted)" fontSize={7} fontFamily="monospace">N</text>
      <text x={cx + outerR + 6} y={cy + 2.5} textAnchor="start" fill="var(--accent-text-muted)" fontSize={7} fontFamily="monospace">E</text>
      <text x={cx} y={cy + outerR + 9} textAnchor="middle" fill="var(--accent-text-muted)" fontSize={7} fontFamily="monospace">S</text>
      <text x={cx - outerR - 6} y={cy + 2.5} textAnchor="end" fill="var(--accent-text-muted)" fontSize={7} fontFamily="monospace">W</text>
      <line x1={cx} y1={cy} x2={knobX} y2={knobY} stroke="var(--accent)" strokeWidth="1.5" opacity="0.5" />
      <circle cx={knobX} cy={knobY} r={5} fill="var(--accent)" />
      <circle cx={knobX} cy={knobY} r={9} fill="none" stroke="var(--accent)" opacity="0.3">
        <animate attributeName="r" values="5;11;5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={10} fill="transparent" stroke="var(--accent-border-med)" strokeWidth="0.5"
        onMouseDown={e => { e.stopPropagation(); onStop() }} style={{ cursor: 'pointer' }} />
      <text x={cx} y={cy + 2} textAnchor="middle" fill="var(--accent-text-muted)" fontSize={6} fontFamily="monospace"
        onMouseDown={e => { e.stopPropagation(); onStop() }} style={{ cursor: 'pointer' }}>STOP</text>
      {/* Speed label */}
      {throttle > 0.01 && (
        <text x={cx} y={cy + 20} textAnchor="middle" fill="var(--accent)" fontSize={8} fontFamily="monospace">
          {speedPct}%
        </text>
      )}
    </svg>
  )
}
