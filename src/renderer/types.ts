export type Role = 'ADMIN' | 'USER'
export type BiometricStatus = 'SET' | 'GET'

export interface User {
  id: number
  username: string | null
  email: string | null
  name: string
  role: Role | string
  biometricStatus: BiometricStatus | string
  createdAt: string
  updatedAt: string
}

export interface UserCreateInput {
  username?: string
  email?: string
  password?: string
  name?: string
  role?: string
}

export interface UserUpdateInput {
  id: number
  username?: string
  email?: string
  name?: string
  role?: string
  password?: string
}

export interface EspStatus {
  listening: boolean
  port: number
  connected: boolean
  clientCount: number
  clients: string[]
}

export interface EspLogEntry {
  id: number
  time: string
  type: 'info' | 'rx' | 'tx' | 'error'
  remote: string
  message: string
}

declare global {
  interface Window {
    api: {
      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
        setTheme: (theme: string) => Promise<void>
        onMaximized: (cb: (maximized: boolean) => void) => void
      }
      auth: {
        login: (data: { username: string; password: string }) => Promise<User>
        logout: () => Promise<boolean>
        me: () => Promise<User | null>
      }
      users: {
        list: () => Promise<User[]>
        get: (id: number) => Promise<User>
        create: (data: UserCreateInput) => Promise<User>
        update: (data: UserUpdateInput) => Promise<User>
        delete: (id: number) => Promise<boolean>
        resetBiometric: (id: number) => Promise<User>
      }
      esp: {
        getStatus: () => Promise<EspStatus>
        getLogs: () => Promise<EspLogEntry[]>
        clearLogs: () => Promise<boolean>
        onStatus: (cb: (status: EspStatus) => void) => () => void
        onLog: (cb: (entry: EspLogEntry) => void) => () => void
        onLogsCleared: (cb: () => void) => () => void
      }
    }
  }
}

export {}
