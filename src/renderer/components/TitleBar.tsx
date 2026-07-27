import { useEffect, useState } from 'react'
import { useTheme } from '../ThemeContext'

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    window.api.window.isMaximized().then(setMaximized)
    window.api.window.onMaximized(setMaximized)
  }, [])

  return (
    <div
      className="h-10 flex items-center justify-between px-4 select-none"
      style={{
        WebkitAppRegion: 'drag' as unknown as string,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--accent-border)'
      }}
    >
      <div className="flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px var(--accent-glow))' }}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 12a4 4 0 1 0-4-4" />
          <path d="M4 20c1.5-3 4-5 8-5s6.5 2 8 5" />
        </svg>
        <span className="text-sm font-mono font-semibold tracking-[3px]" style={{ color: 'var(--accent-text-bright)', textShadow: '0 0 8px var(--accent-text-very-dim)' }}>
          User Admin
        </span>
      </div>

      <div
        className="flex absolute right-0 top-0 h-10"
        style={{ WebkitAppRegion: 'no-drag' as unknown as string }}
      >
        <button
          onClick={toggleTheme}
          className="w-11 h-full flex items-center justify-center transition-colors"
          style={{ color: 'var(--accent-text-faint)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-text-faint)' }}
        >
          {theme === 'dark' ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>

        <button
          onClick={() => window.api.window.minimize()}
          className="w-11 h-full flex items-center justify-center transition-colors"
          style={{ color: 'var(--accent-text-faint)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-text-faint)' }}
        >
          <svg width="11" height="11" viewBox="0 0 12 1" fill="currentColor"><rect width="12" height="1" /></svg>
        </button>
        <button
          onClick={() => window.api.window.maximize()}
          className="w-11 h-full flex items-center justify-center transition-colors"
          style={{ color: 'var(--accent-text-faint)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-text-faint)' }}
        >
          {maximized ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="9" height="9" rx="1" />
              <path d="M9 3V1.5A1.5 1.5 0 0 0 7.5 0h-6A1.5 1.5 0 0 0 0 1.5v6A1.5 1.5 0 0 0 1.5 9H3" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="10" height="10" rx="1" />
            </svg>
          )}
        </button>
        <button
          onClick={() => window.api.window.close()}
          className="w-11 h-full flex items-center justify-center transition-colors"
          style={{ color: 'var(--accent-text-faint)' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#ff0044'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-text-faint)' }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 1l10 10M11 1L1 11" />
          </svg>
        </button>
      </div>
    </div>
  )
}
