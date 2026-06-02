export default function About() {
  return (
    <div className="space-y-4">
      <h2 className="hud-title text-xs tracking-[4px]">System Configuration</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HudSection title="Vehicle Hardware">
          <Row label="MCU" value="ESP32" />
          <Row label="WiFi" value="802.11 b/g/n (Station + AP)" />
          <Row label="Temperature Sensor" value="DS18B20 / DHT22" />
          <Row label="Flame Sensor" value="KY-026 / IR Flame" />
          <Row label="Ultrasonic Sensor" value="HC-SR04" />
          <Row label="Motor Driver" value="L298N / TB6612" />
        </HudSection>

        <HudSection title="Control Station">
          <Row label="App Version" value="1.0.0" />
          <Row label="Platform" value={navigator.platform} />
          <Row label="Electron" value={navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] || '—'} />
          <Row label="Database" value="SQLite via Prisma ORM" />
          <Row label="UI" value="React + TailwindCSS" />
        </HudSection>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HudSection title="Communication">
          <Row label="Protocol" value="TCP over WiFi" />
          <Row label="Port" value="9000" />
          <Row label="Data Format" value="JSON" />
          <Row label="Telemetry Rate" value="~10 Hz" />
          <Row label="Status" value="SIMULATED (no hardware)" />
        </HudSection>

        <HudSection title="Navigation">
          <Row label="Default Mode" value="Autonomous" />
          <Row label="Localization" value="GPS + Dead Reckoning" />
          <Row label="Obstacle Avoidance" value="Ultrasonic (HC-SR04)" />
          <Row label="Waypoint Routing" value="Point-to-Point" />
        </HudSection>
      </div>
    </div>
  )
}

function HudSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hud-panel p-0">
      <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--accent-border)' }}>
        <h3 className="hud-title">{title}</h3>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--accent-bg-tile)' }}>{children}</div>
      <span className="corner-bl">└</span>
      <span className="corner-br">┘</span>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-2">
      <span className="text-xs font-mono" style={{ color: 'var(--accent-text-label)' }}>{label}</span>
      <span className="text-xs font-mono text-right" style={{ color: 'var(--accent-text-bright)' }}>{value}</span>
    </div>
  )
}
