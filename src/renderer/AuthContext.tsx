import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from './types'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const me = await window.api.auth.me()
    setUser(me)
  }

  useEffect(() => {
    refresh()
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    const loggedIn = await window.api.auth.login({ username, password })
    setUser(loggedIn)
    return loggedIn
  }

  const logout = async () => {
    await window.api.auth.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
