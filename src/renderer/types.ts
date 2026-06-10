export interface Obstacle {
  a: number
  d: number
}

export interface Telemetry {
  speed: number
  batteryLevel: number
  batteryVoltage: number
  temperature: number
  flameDetected: boolean
  ultrasonicLeft: number
  ultrasonicRight: number
  heading: number
  latitude: number
  longitude: number
  altitude: number
  status: string
  mode: string
  navState: string
  targetLat: number
  targetLng: number
  wifiSignal: number
  connected: boolean
  lastSeen: number | null
  posX: number
  posY: number
  posH: number
  obstacles: Obstacle[]
}

export interface CommandLog {
  time: string
  command: string
  result: string
}

export interface Waypoint {
  id: number
  lat: number
  lng: number
  label: string
  createdAt: string
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
      getTelemetry: () => Promise<Telemetry>
      getStatus: () => Promise<Telemetry>
      sendCommand: (cmd: string) => Promise<{ success: boolean; message: string }>
      getCommandLog: () => Promise<CommandLog[]>
      getWaypoints: () => Promise<Waypoint[]>
      addWaypoint: (data: { lat: number; lng: number; label: string }) => Promise<Waypoint>
      deleteWaypoint: (id: number) => Promise<void>
      getSessions: () => Promise<{ id: number; name: string; status: string; startedAt: string }[]>
      getLogs: (sessionId: number) => Promise<{ id: number; type: string; message: string; createdAt: string }[]>
    }
  }
}
