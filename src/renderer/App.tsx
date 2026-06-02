import { Routes, Route, NavLink } from 'react-router-dom'
import TitleBar from './components/TitleBar'
import Home from './pages/Home'
import Map from './pages/Map'
import About from './pages/About'

export default function App() {
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <nav className="w-44 shrink-0 hud-nav flex flex-col pt-3 gap-0.5">
          <span className="px-4 pb-2 text-[9px] font-mono tracking-[4px] uppercase" style={{ color: 'var(--accent-text-dim)' }}>
            Systems
          </span>
          <NavLink to="/" className="block w-full text-left px-4 py-2 text-xs font-mono tracking-wider uppercase transition-all duration-150 border-l-2" style={({ isActive }) => ({ borderColor: isActive ? 'var(--accent)' : 'transparent', color: isActive ? 'var(--accent)' : 'var(--accent-text-muted)', background: isActive ? 'var(--accent-bg-tile)' : 'transparent' })}>Dashboard</NavLink>
          <NavLink to="/map" className="block w-full text-left px-4 py-2 text-xs font-mono tracking-wider uppercase transition-all duration-150 border-l-2" style={({ isActive }) => ({ borderColor: isActive ? 'var(--accent)' : 'transparent', color: isActive ? 'var(--accent)' : 'var(--accent-text-muted)', background: isActive ? 'var(--accent-bg-tile)' : 'transparent' })}>Tactical Map</NavLink>
          <NavLink to="/about" className="block w-full text-left px-4 py-2 text-xs font-mono tracking-wider uppercase transition-all duration-150 border-l-2" style={({ isActive }) => ({ borderColor: isActive ? 'var(--accent)' : 'transparent', color: isActive ? 'var(--accent)' : 'var(--accent-text-muted)', background: isActive ? 'var(--accent-bg-tile)' : 'transparent' })}>System Info</NavLink>
        </nav>
        <main className="flex-1 overflow-auto p-5">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<Map />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
      </div>
      <footer className="h-6 flex items-center px-4 text-[10px] font-mono" style={{ borderTop: '1px solid var(--accent-border)', color: 'var(--accent-text-dim)' }}>
        <span className="tracking-wider">AGV CONTROL SYSTEM v1.0</span>
        <span className="mx-3 opacity-30">|</span>
        <span>ESP32 · TCP/9000</span>
        <span className="mx-3 opacity-30">|</span>
        <span className="animate-data-blink">SYS ONLINE</span>
      </footer>
    </div>
  )
}
