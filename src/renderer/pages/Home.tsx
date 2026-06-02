import { useEffect, useState, useCallback } from 'react'
import type { Telemetry } from '../types'

export default function Home() {
  const [t, setT] = useState<Telemetry | null>(null)

  const refresh = useCallback(async () => {
    setT(await window.api.getTelemetry())
  }, [])

  useEffect(() => {
    refresh()
    const iv = setInterval(refresh, 1200)
    return () => clearInterval(iv)
  }, [refresh])

  if (!t) {
    return <div className="flex items-center justify-center h-64 text-sm font-mono" style={{ color: 'var(--accent-text-faint)' }}>Establishing uplink...</div>
  }

  return (
    <div className="space-y-4">
      {/* ── Top status bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="hud-title text-xs tracking-[4px]">Sensor Suite</span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--accent-text-faint)' }}>|</span>
          <span className="flex items-center gap-2" style={{ color: t.status === 'running' ? '#00ff88' : t.status === 'emergency' ? '#ff0044' : 'var(--accent-text-muted)' }}>
            <span className="h-1.5 w-1.5" style={{
              background: 'currentColor',
              boxShadow: '0 0 6px currentColor',
              opacity: t.status === 'running' ? 1 : 0.5
            }} />
            <span className="text-[10px] font-mono tracking-wider">{t.status.toUpperCase()}</span>
          </span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--accent-text-faint)' }}>|</span>
          <span className="text-[10px] font-mono tracking-wider" style={{ color: t.mode === 'autonomous' ? 'rgba(0,255,136,0.7)' : 'rgba(255,170,0,0.7)' }}>
            {t.mode === 'autonomous' ? '► AUTO' : '◉ MANUAL'}
          </span>
        </div>
        <span className="text-[10px] font-mono animate-data-blink" style={{ color: 'var(--accent-text-faint)' }}>
          {new Date().toLocaleTimeString()} UTC
        </span>
      </div>

      {/* ── Main grid: Sensors + Telemetry + Radar ── */}
      <div className="grid grid-cols-[1fr_1.2fr] gap-4">
        {/* Left column - Sensors */}
        <div className="hud-panel p-0">
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--accent-border)' }}>
            <span className="hud-title">Environmental Sensors</span>
          </div>
          <div className="p-4 grid grid-cols-1 gap-3">
            <SensorTile
              label="Temperature"
              value={`${t.temperature.toFixed(1)}°C`}
              bars={35}
              max={60}
              color={t.temperature > 45 ? '#ff0044' : t.temperature > 38 ? '#ffaa00' : '#00ff88'}
              icon="⟐"
            />
            <SensorTile
              label="Flame Detection"
              value={t.flameDetected ? 'FIRE' : 'CLEAR'}
              bars={t.flameDetected ? 100 : 0}
              max={100}
              color={t.flameDetected ? '#ff0044' : '#00ff88'}
              icon="⟡"
              alert={t.flameDetected}
            />
            <SensorTile
              label="Ultrasonic"
              value={`${t.ultrasonicDistance.toFixed(0)} cm`}
              bars={Math.max(0, 180 - t.ultrasonicDistance)}
              max={180}
              color={t.ultrasonicDistance < 30 ? '#ff0044' : t.ultrasonicDistance < 60 ? '#ffaa00' : '#00ff88'}
              icon="⟐"
            />
          </div>
          <span className="corner-bl">└</span>
          <span className="corner-br">┘</span>
        </div>

        {/* Right column - Telemetry + Radar */}
        <div className="space-y-4">
          <div className="hud-panel p-0">
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--accent-border)' }}>
              <span className="hud-title">Vehicle Telemetry</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <HUDTile label="Speed" value={`${t.speed.toFixed(2)}`} unit="m/s" color={t.speed > 0 ? '#00ff88' : 'var(--accent-text-muted)'} />
              <HUDTile label="Battery" value={`${t.batteryLevel.toFixed(0)}%`} unit={`${t.batteryVoltage.toFixed(1)}V`} color={t.batteryLevel > 50 ? '#00ff88' : t.batteryLevel > 20 ? '#ffaa00' : '#ff0044'} />
              <HUDTile label="Heading" value={`${t.heading.toFixed(0)}°`} unit={degStr(t.heading)} color="var(--accent)" />
              <HUDTile label="Altitude" value={`${t.altitude.toFixed(0)}`} unit="m" color="var(--accent)" />
            </div>
            <span className="corner-bl">└</span>
            <span className="corner-br">┘</span>
          </div>

          {/* Radar mini-map */}
          <Radar telemetry={t} />
        </div>
      </div>

      {/* ── Position + WiFi row ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="hud-panel p-0">
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--accent-border)' }}>
            <span className="hud-title">GPS Coordinates</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <HUDTile label="Latitude" value={t.latitude.toFixed(6)} unit="°N" color="var(--accent)" />
            <HUDTile label="Longitude" value={t.longitude.toFixed(6)} unit="°E" color="var(--accent)" />
          </div>
          <span className="corner-bl">└</span>
          <span className="corner-br">┘</span>
        </div>
        <div className="hud-panel p-0">
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--accent-border)' }}>
            <span className="hud-title">WiFi Signal</span>
          </div>
          <div className="p-4">
            <WifiSignal strength={t.wifiSignal} />
          </div>
          <span className="corner-bl">└</span>
          <span className="corner-br">┘</span>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function SensorTile({ label, value, bars, max, color, icon, alert }: {
  label: string; value: string; bars: number; max: number; color: string; icon: string; alert?: boolean
}) {
  const pct = Math.min(100, (bars / max) * 100)
  return (
    <div className="hud-tile px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-2">
          <span style={{ color }} className="text-xs">{icon}</span>
          <span className="hud-tile-label">{label}</span>
        </span>
        {alert && <span className="text-[9px] font-mono tracking-widest animate-pulse-glow" style={{ color: '#ff0044', textShadow: '0 0 8px #ff0044' }}>ALERT</span>}
      </div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-base font-mono font-bold hud-glow" style={{ color, textShadow: `0 0 12px ${color}` }}>{value}</span>
      </div>
      <div className="h-1.5" style={{ background: 'var(--accent-bg-tile)' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  )
}

function HUDTile({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="hud-tile px-3 py-2.5">
      <span className="hud-tile-label">{label}</span>
      <div className="mt-0.5">
        <span className="text-lg font-mono font-bold" style={{ color, textShadow: `0 0 12px ${color}` }}>{value}</span>
        <span className="ml-1.5 hud-tile-unit">{unit}</span>
      </div>
    </div>
  )
}

function Radar({ telemetry: t }: { telemetry: Telemetry }) {
  const cx = 90, cy = 90, maxR = 85, maxRange = 180
  const a = (t.heading - 90) * Math.PI / 180
  const d = Math.min(t.ultrasonicDistance, maxRange)
  const bx = cx + (d / maxRange) * maxR * Math.cos(a)
  const by = cy + (d / maxRange) * maxR * Math.sin(a)
  const hx = cx + maxR * Math.cos(a)
  const hy = cy + maxR * Math.sin(a)
  const color = d > 60 ? '#00ff88' : d > 30 ? '#ffaa00' : '#ff0044'

  const halfCone = 15
  const cone1 = (t.heading - 90 - halfCone) * Math.PI / 180
  const cone2 = (t.heading - 90 + halfCone) * Math.PI / 180
  const c1x = cx + maxR * Math.cos(cone1)
  const c1y = cy + maxR * Math.sin(cone1)
  const c2x = cx + maxR * Math.cos(cone2)
  const c2y = cy + maxR * Math.sin(cone2)

  return (
    <div className="hud-panel p-0">
      <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--accent-border)' }}>
        <span className="hud-title">Radar</span>
      </div>
      <div className="p-4 flex justify-center">
        <svg width="180" height="180" viewBox="0 0 180 180" className="data-flicker">
          <circle cx={cx} cy={cy} r={maxR} className="radar-circle" />
          <circle cx={cx} cy={cy} r={60} className="radar-circle" />
          <circle cx={cx} cy={cy} r={35} className="radar-circle" />
          <line x1="5" y1={cy} x2="175" y2={cy} stroke="rgba(0,240,255,0.06)" strokeWidth="0.5" />
          <line x1={cx} y1="5" x2={cx} y2="175" stroke="rgba(0,240,255,0.06)" strokeWidth="0.5" />
          <line x1="27" y1="27" x2="153" y2="153" stroke="rgba(0,240,255,0.04)" strokeWidth="0.3" />
          <line x1="153" y1="27" x2="27" y2="153" stroke="rgba(0,240,255,0.04)" strokeWidth="0.3" />

          {/* Sweep */}
          <g className="radar-sweep">
            <polygon points={`${cx},${cy} ${cx},5 ${cx + maxR},${cy}`} fill="rgba(0,240,255,0.04)" />
            <line x1={cx} y1={cy} x2={cx} y2="5" stroke="rgba(0,240,255,0.2)" strokeWidth="1" />
          </g>

          {/* Sensor cone */}
          <path d={`M${cx},${cy} L${c1x},${c1y} A${maxR},${maxR} 0 0,1 ${c2x},${c2y} Z`} fill="rgba(0,240,255,0.03)" />

          {/* Heading line */}
          <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="rgba(0,240,255,0.2)" strokeWidth="0.5" strokeDasharray="3 3" />

          {/* Sensor beam */}
          <line x1={cx} y1={cy} x2={bx} y2={by} stroke={color} strokeWidth="1" opacity="0.4" />

          {/* Blip at detected distance */}
          <circle cx={bx} cy={by} r="3" fill={color} opacity="0.9">
            <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={bx} cy={by} r="7" fill="none" stroke={color} opacity="0.3" strokeWidth="0.5">
            <animate attributeName="r" values="3;10;3" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" />
          </circle>

          {/* Center dot */}
          <circle cx={cx} cy={cy} r="2" fill="var(--accent)" opacity="0.8" />

          <text x={cx} y="177" textAnchor="middle" fill="var(--accent-text-very-dim)" fontSize="8" fontFamily="monospace">
            RNG {maxRange}cm · {d.toFixed(0)}cm
          </text>
        </svg>
      </div>
      <span className="corner-bl">└</span>
      <span className="corner-br">┘</span>
    </div>
  )
}

function WifiSignal({ strength }: { strength: number }) {
  const bars = 4
  const activeBars = strength >= -40 ? 4 : strength >= -55 ? 3 : strength >= -70 ? 2 : strength >= -85 ? 1 : 0
  const color = activeBars >= 3 ? '#00ff88' : activeBars >= 2 ? '#00f0ff' : activeBars >= 1 ? '#ffaa00' : '#ff0044'

  return (
    <div className="flex items-center gap-5">
      <div className="flex items-end gap-[3px] h-8">
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className="w-[3px] transition-all duration-500"
            style={{
              height: `${6 + i * 7}px`,
              background: i < activeBars ? color : 'var(--accent-border-subtle)',
              boxShadow: i < activeBars ? `0 0 6px ${color}` : 'none'
            }}
          />
        ))}
      </div>
      <div>
        <div className="text-lg font-mono font-bold" style={{ color, textShadow: `0 0 12px ${color}` }}>
          {strength.toFixed(0)} dBm
        </div>
        <div className="text-[10px] font-mono" style={{ color: activeBars >= 2 ? 'var(--accent-text-muted)' : 'rgba(255,0,68,0.5)' }}>
          {activeBars >= 3 ? 'EXCELLENT' : activeBars >= 2 ? 'GOOD' : activeBars >= 1 ? 'WEAK' : 'NO SIGNAL'}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', color: 'var(--accent-text-dim)' }} className="text-[10px] font-mono">
        <div>TCP :9000</div>
        <div>192.168.137.1</div>
      </div>
    </div>
  )
}

function degStr(d: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(d / 22.5) % 16]
}
