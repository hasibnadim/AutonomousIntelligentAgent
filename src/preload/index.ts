import { contextBridge, ipcRenderer } from 'electron'

const api = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    setTheme: (theme: string) => ipcRenderer.invoke('window:setTheme', theme),
    onMaximized: (cb: (maximized: boolean) => void) => {
      ipcRenderer.on('window:maximized', (_event, value) => cb(value))
    }
  },
  auth: {
    login: (data: { username: string; password: string }) =>
      ipcRenderer.invoke('auth:login', data),
    logout: () => ipcRenderer.invoke('auth:logout'),
    me: () => ipcRenderer.invoke('auth:me')
  },
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    get: (id: number) => ipcRenderer.invoke('users:get', id),
    create: (data: {
      id?: number
      userId?: number
      username?: string
      email?: string
      password?: string
      name?: string
      role?: string
    }) => ipcRenderer.invoke('users:create', data),
    update: (data: {
      id: number
      userId?: number
      username?: string
      email?: string
      name?: string
      role?: string
      password?: string
    }) => ipcRenderer.invoke('users:update', data),
    delete: (id: number) => ipcRenderer.invoke('users:delete', id),
    resetBiometric: (id: number) => ipcRenderer.invoke('users:resetBiometric', id)
  },
  activity: {
    list: (search?: string) => ipcRenderer.invoke('activity:list', search),
    onNew: (cb: (entry: any) => void) => {
      const handler = (_event: any, entry: any) => cb(entry)
      ipcRenderer.on('activity:new', handler)
      return () => ipcRenderer.removeListener('activity:new', handler)
    }
  },
  esp: {
    getStatus: () => ipcRenderer.invoke('esp:getStatus'),
    getLogs: () => ipcRenderer.invoke('esp:getLogs'),
    clearLogs: () => ipcRenderer.invoke('esp:clearLogs'),
    onStatus: (cb: (status: any) => void) => {
      const handler = (_event: any, status: any) => cb(status)
      ipcRenderer.on('esp:status', handler)
      return () => ipcRenderer.removeListener('esp:status', handler)
    },
    onLog: (cb: (entry: any) => void) => {
      const handler = (_event: any, entry: any) => cb(entry)
      ipcRenderer.on('esp:log', handler)
      return () => ipcRenderer.removeListener('esp:log', handler)
    },
    onLogsCleared: (cb: () => void) => {
      const handler = () => cb()
      ipcRenderer.on('esp:logsCleared', handler)
      return () => ipcRenderer.removeListener('esp:logsCleared', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
