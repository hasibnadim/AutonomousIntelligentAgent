/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI"', '"Segoe UI Variable"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Consolas', '"Courier New"', 'monospace']
      },
      colors: {
        theme: {
          bg: 'var(--bg)',
          surface: 'var(--surface)',
          border: 'var(--border)',
          text: 'var(--text)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
          'text-bright': 'var(--text-bright)',
          hover: 'var(--hover)',
          'hover-overlay': 'var(--hover-overlay)',
          'status-bg': 'var(--status-bg)',
          'status-text': 'var(--status-text)',
          separator: 'var(--separator)',
          'loading-text': 'var(--loading-text)',
          'titlebar-text': 'var(--titlebar-text)',
          'btn-slate-bg': 'var(--btn-slate-bg)',
          'btn-slate-text': 'var(--btn-slate-text)',
          'btn-slate-border': 'var(--btn-slate-border)',
        },
        hud: {
          cyan: '#00f0ff',
          green: '#00ff88',
          amber: '#ffaa00',
          red: '#ff0044'
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'flicker': 'flicker 3s ease-in-out infinite',
        'radar-spin': 'radar-spin 4s linear infinite',
        'data-blink': 'data-blink 1.5s step-end infinite',
        'scan-sweep': 'scan-sweep 3s linear infinite',
      }
    }
  },
  plugins: []
}
