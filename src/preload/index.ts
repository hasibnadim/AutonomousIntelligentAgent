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
  getTelemetry: () => ipcRenderer.invoke('vehicle:getTelemetry'),
  getStatus: () => ipcRenderer.invoke('vehicle:getStatus'),
  sendCommand: (cmd: string) => ipcRenderer.invoke('vehicle:sendCommand', cmd),
  getCommandLog: () => ipcRenderer.invoke('vehicle:getCommandLog'),
  getWaypoints: () => ipcRenderer.invoke('db:getWaypoints'),
  addWaypoint: (data: { lat: number; lng: number; label: string }) =>
    ipcRenderer.invoke('db:addWaypoint', data),
  deleteWaypoint: (id: number) => ipcRenderer.invoke('db:deleteWaypoint', id),
  getSessions: () => ipcRenderer.invoke('db:getSessions'),
  getLogs: (sessionId: number) => ipcRenderer.invoke('db:getLogs', sessionId)
}

contextBridge.exposeInMainWorld('api', api)
