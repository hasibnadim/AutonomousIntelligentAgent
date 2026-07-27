import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import TitleBar from './components/TitleBar'
import { useAuth } from './AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Profile from './pages/Profile'

function Shell() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <nav className="w-44 shrink-0 hud-nav flex flex-col pt-3 gap-0.5">
          <span className="px-4 pb-2 text-[9px] font-mono tracking-[4px] uppercase" style={{ color: 'var(--accent-text-dim)' }}>
            Menu
          </span>
          <NavLink
            to="/"
            end
            className="block w-full text-left px-4 py-2 text-xs font-mono tracking-wider uppercase transition-all duration-150 border-l-2"
            style={({ isActive }) => ({
              borderColor: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--accent-text-muted)',
              background: isActive ? 'var(--accent-bg-tile)' : 'transparent'
            })}
          >
            Dashboard
          </NavLink>
          {isAdmin && (
            <NavLink
              to="/users"
              className="block w-full text-left px-4 py-2 text-xs font-mono tracking-wider uppercase transition-all duration-150 border-l-2"
              style={({ isActive }) => ({
                borderColor: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--accent-text-muted)',
                background: isActive ? 'var(--accent-bg-tile)' : 'transparent'
              })}
            >
              Users
            </NavLink>
          )}
          <NavLink
            to="/profile"
            className="block w-full text-left px-4 py-2 text-xs font-mono tracking-wider uppercase transition-all duration-150 border-l-2"
            style={({ isActive }) => ({
              borderColor: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--accent-text-muted)',
              background: isActive ? 'var(--accent-bg-tile)' : 'transparent'
            })}
          >
            Profile
          </NavLink>

          <div className="mt-auto p-3">
            <p className="text-[10px] font-mono mb-2 truncate" style={{ color: 'var(--accent-text-dim)' }}>
              {user?.username || user?.name} · {user?.role}
            </p>
            <button
              onClick={() => logout()}
              className="w-full px-3 py-2 text-[10px] font-mono tracking-wider uppercase"
              style={{ border: '1px solid var(--accent-border-med)', color: 'var(--accent-text-muted)' }}
            >
              Sign Out
            </button>
          </div>
        </nav>

        <main className="flex-1 overflow-auto p-5">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <footer
        className="h-6 flex items-center px-4 text-[10px] font-mono"
        style={{ borderTop: '1px solid var(--accent-border)', color: 'var(--accent-text-dim)' }}
      >
        <span className="tracking-wider">USER ADMIN v1.0</span>
        <span className="mx-3 opacity-30">|</span>
        <span>ESP · TCP/9000</span>
        <span className="mx-3 opacity-30">|</span>
        <span>SQLite · Prisma</span>
      </footer>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <TitleBar />
        <div className="flex-1 flex items-center justify-center text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          Loading…
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <TitleBar />
        <Login />
      </div>
    )
  }

  return <Shell />
}
