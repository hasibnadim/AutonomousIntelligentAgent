import { useEffect, useState, useCallback, useRef } from 'react'
import type { Telemetry, CommandLog, Waypoint } from '../types'

export default function Map() {
  const [t, setT] = useState<Telemetry | null>(null)
  const [log, setLog] = useState<CommandLog[]>([])
  const [wpts, setWpts] = useState<Waypoint[]>([])
  const [cmd, setCmd] = useState('')
  const [obstacleTrail, setObstacleTrail] = useState<{x: number; y: number; color: string; age: number}[]>([])
  const [posTrail, setPosTrail] = useState<{x: number; y: number}[]>([])

  const refresh = useCallback(async () => {
    try { setT(await window.api.getTelemetry()) } catch { setT(null) }
    try { setLog(await window.api.getCommandLog()) } catch { setLog([]) }
    try { setWpts(await window.api.getWaypoints()) } catch { setWpts([]) }
  }, [])

  useEffect(() => {
    refresh()
    const iv = setInterval(refresh, 1000)
    const unsub = window.api.onVehicleLiveData((d: any) => {
      setT((prev) => prev ? { ...prev, ...d } : d)
    })
    return () => { clearInterval(iv); unsub?.() }
  }, [refresh])

  // Track obstacle trail from ultrasonic readings
  useEffect(() => {
    if (!t) return
    const d = Math.min(t.ultrasonicLeft, t.ultrasonicRight)
    const color = d > 60 ? '#00ff88' : d > 30 ? '#ffaa00' : '#ff0044'
    const angleRad = t.heading * Math.PI / 180
    const ox = t.posX + d * Math.sin(angleRad)
    const oy = t.posY + d * Math.cos(angleRad)
    setObstacleTrail(prev => [...prev.slice(-500), { x: ox, y: oy, color, age: 0 }])
  }, [t?.ultrasonicLeft, t?.ultrasonicRight, t?.heading, t?.posX, t?.posY])

  // Track vehicle position trail
  useEffect(() => {
    if (!t) return
    setPosTrail(prev => [...prev.slice(-200), { x: t.posX, y: t.posY }])
  }, [t?.posX, t?.posY])

  // Age obstacle trail
  useEffect(() => {
    const iv = setInterval(() => {
      setObstacleTrail(prev => prev.map(o => ({ ...o, age: o.age + 1 })).filter(o => o.age < 30))
    }, 2000)
    return () => clearInterval(iv)
  }, [])

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

  const clearMap = useCallback(() => { setObstacleTrail([]); setPosTrail([]) }, [])

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

      {/* ── Connection status ── */}
      <div className="flex items-center gap-2 px-1" style={{ color: t.connected ? '#00ff88' : '#ff0044' }}>
        <span className="h-1.5 w-1.5" style={{ background: 'currentColor', boxShadow: `0 0 6px currentColor` }} />
        <span className="text-[10px] font-mono tracking-widest">
          {t.connected ? `LINK ESTABLISHED ${t.lastSeen ? new Date(t.lastSeen).toLocaleTimeString() : ''}` : 'NO LINK — ESP32 OFFLINE'}
        </span>
      </div>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="hud-title text-xs tracking-[4px]">2D World</span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--accent-text-faint)' }}>|</span>
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-wider" style={{ color: 'var(--accent-text-muted)' }}>MODE</span>
            <span className="text-[10px] font-mono tracking-wider" style={{ color: t.mode === 'autonomous' ? '#00ff88' : '#ffaa00' }}>
              {t.mode.toUpperCase()}
            </span>
          </span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--accent-text-faint)' }}>|</span>
          <span className="text-[10px] font-mono tracking-wider" style={{ color: 'rgba(0,240,255,0.7)' }}>
            NAV: {t.navState.toUpperCase()}
          </span>
        </div>
        <span className="text-[10px] font-mono animate-data-blink" style={{ color: 'var(--accent-text-faint)' }}>
          STA: {t.connected ? 'ONLINE' : 'OFFLINE'} · {t.wifiSignal.toFixed(0)} dBm
        </span>
      </div>

      {/* ── Main: Map + Sidebar ── */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* 2D Gazebo-style World */}
        <div className="flex-1 hud-panel p-0 overflow-hidden">
          <WorldMap telemetry={t} obstacleTrail={obstacleTrail} posTrail={posTrail} />
          <span className="corner-bl">└</span>
          <span className="corner-br">┘</span>
        </div>

        {/* Right sidebar */}
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
              <button onClick={clearMap} className="hud-btn px-2 py-1.5 text-[9px] border tracking-[2px] transition-all duration-150"
                style={{ borderColor: 'var(--accent-text-dim)', color: 'var(--accent-text-muted)' }}>
                CLEAR MAP
              </button>
            </div>
            <span className="corner-bl">└</span>
            <span className="corner-br">┘</span>
          </div>

          {/* Sensor summary */}
          <div className="hud-panel p-0 flex-1 overflow-hidden flex flex-col">
            <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--accent-border)' }}>
              <span className="hud-title text-[9px]">Sensors</span>
            </div>
            <div className="p-3 space-y-2 text-[10px] font-mono">
              <div className="flex justify-between" style={{ color: 'var(--accent-text-muted)' }}>
                <span>TEMP</span>
                <span style={{ color: t.temperature > 45 ? '#ff0044' : t.temperature > 38 ? '#ffaa00' : '#00ff88' }}>
                  {t.temperature.toFixed(1)}°C
                </span>
              </div>
              <div className="flex justify-between" style={{ color: 'var(--accent-text-muted)' }}>
                <span>FLAME</span>
                <span style={{ color: t.flameDetected ? '#ff0044' : '#00ff88' }}>
                  {t.flameDetected ? 'DETECTED' : 'CLEAR'}
                </span>
              </div>
              <div className="flex justify-between" style={{ color: 'var(--accent-text-muted)' }}>
                <span>US-L</span>
                <span style={{ color: t.ultrasonicLeft < 30 ? '#ff0044' : '#00ff88' }}>
                  {t.ultrasonicLeft.toFixed(0)}cm
                </span>
              </div>
              <div className="flex justify-between" style={{ color: 'var(--accent-text-muted)' }}>
                <span>US-R</span>
                <span style={{ color: t.ultrasonicRight < 30 ? '#ff0044' : '#00ff88' }}>
                  {t.ultrasonicRight.toFixed(0)}cm
                </span>
              </div>
              <div className="flex justify-between" style={{ color: 'var(--accent-text-muted)' }}>
                <span>POS</span>
                <span style={{ color: 'var(--accent)' }}>
                  ({t.posX.toFixed(0)},{t.posY.toFixed(0)})
                </span>
              </div>
              <div className="flex justify-between" style={{ color: 'var(--accent-text-muted)' }}>
                <span>OBS</span>
                <span style={{ color: 'var(--accent)' }}>
                  {t.obstacles.length}
                </span>
              </div>
            </div>
            <span className="corner-bl">└</span>
            <span className="corner-br">┘</span>
          </div>
        </div>
      </div>

      {/* ── Terminal ── */}
      <div className="hud-panel p-0 shrink-0 max-h-[180px] flex flex-col">
        <div className="px-4 py-2 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--accent-border)' }}>
          <span className="hud-title">Command Terminal</span>
          <span className="text-[9px] font-mono" style={{ color: 'var(--accent-text-very-dim)' }}>stdin &gt;</span>
        </div>
        <div className="p-4 space-y-3 flex-1 min-h-0 flex flex-col">
          <form onSubmit={handleCustom} className="flex gap-2 shrink-0">
            <input type="text" value={cmd} onChange={(e) => setCmd(e.target.value)}
              placeholder="ENTER COMMAND..." className="hud-input flex-1 px-3 py-2 text-xs" />
            <button type="submit" className="hud-btn px-5 py-2 text-xs tracking-[2px] shrink-0"
              style={{ background: 'var(--accent-bg-hover)', border: '1px solid var(--accent-text-very-dim)', color: 'var(--accent)' }}>
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

/* ── 2D Gazebo-style World Map ── */
function WorldMap({ telemetry: t, obstacleTrail, posTrail }: {
  telemetry: Telemetry
  obstacleTrail: {x: number; y: number; color: string; age: number}[]
  posTrail: {x: number; y: number}[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const SCALE = 2
  const VP_W = 500
  const VP_H = 350
  const cx = VP_W / 2
  const cy = VP_H / 2

  const toSx = (x: number) => cx + x * SCALE
  const toSy = (y: number) => cy - y * SCALE

  const vx = toSx(t.posX)
  const vy = toSy(t.posY)
  const angle = t.posH

  return (
    <svg ref={svgRef} viewBox={`0 0 ${VP_W} ${VP_H}`}
      className="w-full h-full data-flicker"
      style={{ background: '#0a0e14' }}>
      <defs>
        <radialGradient id="world-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,240,255,0.04)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="fire-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff0044" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ff0044" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="temp-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffaa00" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffaa00" stopOpacity="0" />
        </radialGradient>
        <filter id="glow-sm"><feGaussianBlur stdDeviation="2" /></filter>
        <filter id="glow-lg"><feGaussianBlur stdDeviation="5" /></filter>
        <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="25" y2="0" stroke="rgba(0,240,255,0.04)" strokeWidth="0.3" />
          <line x1="0" y1="0" x2="0" y2="25" stroke="rgba(0,240,255,0.04)" strokeWidth="0.3" />
        </pattern>
      </defs>

      {/* Grid background */}
      <rect width={VP_W} height={VP_H} fill="url(#grid)" />
      <rect width={VP_W} height={VP_H} fill="url(#world-glow)" />

      {/* Scale markers */}
      {[100, 200, 300, 400].map(d => (
        <circle key={d} cx={cx} cy={cy} r={d * SCALE} fill="none" stroke="rgba(0,240,255,0.05)" strokeWidth="0.5" strokeDasharray="4 4" />
      ))}

      {/* Axis labels */}
      {[100, 200, 300, 400].map(d => (
        <text key={`l${d}`} x={cx + d * SCALE + 3} y={cy + 3} fill="rgba(0,240,255,0.15)" fontSize="6" fontFamily="monospace">{d}cm</text>
      ))}

      {/* Position trail */}
      {posTrail.map((p, i) => (
        <circle key={i} cx={toSx(p.x)} cy={toSy(p.y)} r={1} fill="rgba(0,255,136,0.2)" />
      ))}

      {/* Obstacle trail (from ultrasonic readings) */}
      {obstacleTrail.map((o, i) => {
        const opacity = Math.max(0.05, 1 - o.age / 30) * 0.7
        return <circle key={i} cx={toSx(o.x)} cy={toSy(o.y)} r={2} fill={o.color} opacity={opacity} />
      })}

      {/* ESP32-reported obstacles */}
      {t.obstacles.map((o, i) => {
        const rad = (o.a - 90) * Math.PI / 180
        const ox = t.posX + o.d * Math.cos(rad)
        const oy = t.posY + o.d * Math.sin(rad)
        const color = o.d > 60 ? '#00ff88' : o.d > 30 ? '#ffaa00' : '#ff0044'
        return (
          <g key={`obs${i}`}>
            <circle cx={toSx(ox)} cy={toSy(oy)} r={4} fill={color} opacity={0.15} filter="url(#glow-sm)" />
            <circle cx={toSx(ox)} cy={toSy(oy)} r={2} fill={color} opacity={0.8} />
          </g>
        )
      })}

      {/* Temperature heatmap around vehicle */}
      {t.temperature > 25 && (
        <circle cx={vx} cy={vy} r={Math.min(80, t.temperature * 1.5) * SCALE / 10}
          fill={t.temperature > 45 ? '#ff0044' : '#ffaa00'}
          opacity={Math.min(0.15, (t.temperature - 25) / 200)}
          filter="url(#glow-lg)" />
      )}

      {/* Ultrasonic sensor cone */}
      {(() => {
        const usDist = Math.min(t.ultrasonicLeft, t.ultrasonicRight)
        const usColor = usDist > 60 ? '#00ff88' : usDist > 30 ? '#ffaa00' : '#ff0044'
        const coneHalf = 15 * Math.PI / 180
        const coneLen = Math.min(usDist, 150) * SCALE
        const aRad = (angle - 90) * Math.PI / 180

        const lx = vx + coneLen * Math.sin(angle - coneHalf)
        const ly = vy - coneLen * Math.cos(angle - coneHalf)
        const rx = vx + coneLen * Math.sin(angle + coneHalf)
        const ry = vy - coneLen * Math.cos(angle + coneHalf)

        return (
          <>
            <path d={`M${vx},${vy} L${lx},${ly} A${coneLen},${coneLen} 0 0,1 ${rx},${ry} Z`}
              fill={usColor} opacity="0.05" />
            <path d={`M${vx},${vy} L${lx},${ly} A${coneLen},${coneLen} 0 0,1 ${rx},${ry} Z`}
              fill="none" stroke={usColor} strokeWidth="0.5" opacity="0.3" strokeDasharray="3 3" />
            {/* Sensor beam line */}
            <line x1={vx} y1={vy} x2={vx + coneLen * Math.sin(angle)} y2={vy - coneLen * Math.cos(angle)}
              stroke={usColor} strokeWidth="1" opacity="0.3" />
            {/* Distance arc */}
            <path d={`M${lx},${ly} A${coneLen},${coneLen} 0 0,1 ${rx},${ry}`}
              fill="none" stroke={usColor} strokeWidth="0.5" opacity="0.4" />
          </>
        )
      })()}

      {/* Flame indicator */}
      {t.flameDetected && (
        <g>
          <circle cx={vx} cy={vy} r={30} fill="url(#fire-glow)">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="0.6s" repeatCount="indefinite" />
          </circle>
          <text x={vx} y={vy - 18} textAnchor="middle" fill="#ff0044" fontSize={16} fontWeight="bold"
            style={{ filter: 'drop-shadow(0 0 6px #ff0044)' }}>
            <animate attributeName="opacity" values="1;0.3;1" dur="0.6s" repeatCount="indefinite" />
            &#x25C7;
          </text>
          <text x={vx} y={vy - 28} textAnchor="middle" fill="#ff0044" fontSize={8} fontFamily="monospace" fontWeight="bold"
            style={{ filter: 'drop-shadow(0 0 4px #ff0044)' }}>FIRE</text>
        </g>
      )}

      {/* Heading line */}
      <line x1={vx} y1={vy} x2={vx + 40 * Math.sin(angle)} y2={vy - 40 * Math.cos(angle)}
        stroke="var(--accent)" strokeWidth="1.5" opacity="0.6" />

      {/* Vehicle (diamond shape) */}
      <polygon
        points={`${vx},${vy - 10} ${vx + 7},${vy} ${vx},${vy + 10} ${vx - 7},${vy}`}
        fill="#00ff88" opacity={0.9} stroke="#00ff88" strokeWidth={0.8}
      />
      <circle cx={vx} cy={vy} r={3} fill="#00ff88" opacity={0.6} filter="url(#glow-sm)" />

      {/* Vehicle label */}
      <text x={vx + 12} y={vy + 3} fill="#00ff88" fontSize={9} fontFamily="monospace" opacity={0.9}>AGV</text>
      <text x={vx + 12} y={vy + 11} fill="var(--accent-text-dim)" fontSize={7} fontFamily="monospace">
        ({t.posX.toFixed(0)},{t.posY.toFixed(0)})
      </text>

      {/* Origin marker */}
      <circle cx={cx} cy={cy} r={3} fill="none" stroke="rgba(0,240,255,0.2)" strokeWidth="0.5" />
      <text x={cx + 6} y={cy + 3} fill="rgba(0,240,255,0.2)" fontSize="6" fontFamily="monospace">ORIGIN</text>

      {/* Compass */}
      <g transform="translate(470, 20)">
        <circle r={14} fill="none" stroke="rgba(0,240,255,0.15)" strokeWidth="0.5" />
        <text x={0} y={-8} textAnchor="middle" fill="var(--accent-text-muted)" fontSize="6" fontFamily="monospace">N</text>
        <line x1={0} y1={-10} x2={0} y2={10} stroke="rgba(0,240,255,0.1)" strokeWidth="0.3" />
        <line x1={-10} y1={0} x2={10} y2={0} stroke="rgba(0,240,255,0.1)" strokeWidth="0.3" />
      </g>

      {/* Status bar bottom */}
      <rect x="0" y={VP_H - 18} width={VP_W} height="18" fill="rgba(0,0,0,0.4)" />
      <text x="8" y={VP_H - 6} fill="var(--accent-text-very-dim)" fontSize="7" fontFamily="monospace">
        HDG:{t.heading.toFixed(0)}° SPD:{t.speed} TMP:{t.temperature.toFixed(1)}°C US-L:{t.ultrasonicLeft.toFixed(0)}cm US-R:{t.ultrasonicRight.toFixed(0)}cm NAV:{t.navState}
      </text>
      <text x={VP_W - 8} y={VP_H - 6} textAnchor="end" fill="var(--accent-text-very-dim)" fontSize="7" fontFamily="monospace">
        {new Date().toLocaleTimeString()} · {t.obstacles.length} obstacles
      </text>

      {/* Scan line */}
      <rect x="0" y="0" width={VP_W} height="1.5" fill="rgba(0,240,255,0.03)">
        <animate attributeName="y" from="0" to={VP_H} dur="3s" repeatCount="indefinite" />
      </rect>
    </svg>
  )
}

/* ── Helpers ── */

function HudBtn({ label, cmd, color, active, onClick }: {
  label: string; cmd: string; color: string; active?: boolean; onClick: (c: string) => void
}) {
  const map: Record<string, [string, string, string]> = {
    green: ['rgba(0,255,136,0.15)', 'rgba(0,255,136,0.3)', '#00ff88'],
    amber: ['rgba(255,170,0,0.15)', 'rgba(255,170,0,0.3)', '#ffaa00'],
    red: ['rgba(255,0,68,0.15)', 'rgba(255,0,68,0.3)', '#ff0044'],
    cyan: ['var(--accent-bg-hover)', 'var(--accent-text-dim)', 'var(--accent)'],
  }
  const [bg, border, text] = map[color] || map.cyan
  return (
    <button onClick={() => onClick(cmd)}
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
  heading: number; throttle: number; onNavigate: (deg: number, thr: number) => void; onStop: () => void
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
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const speedPct = Math.round(Math.abs(throttle) * 100)

  return (
    <svg ref={svgRef} width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      className="cursor-pointer select-none" onMouseDown={handleMouseDown} style={{ touchAction: 'none' }}>
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
      {throttle > 0.01 && (
        <text x={cx} y={cy + 20} textAnchor="middle" fill="var(--accent)" fontSize={8} fontFamily="monospace">
          {speedPct}%
        </text>
      )}
    </svg>
  )
}
