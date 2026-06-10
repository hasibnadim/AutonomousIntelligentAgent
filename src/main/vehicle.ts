import { ipcMain } from 'electron'
import { prisma } from './database'

export let vehicleStatus = {
  speed: 0,
  batteryLevel: 0,
  batteryVoltage: 0,
  temperature: 0,
  flameDetected: false,
  ultrasonicLeft: 0,
  ultrasonicRight: 0,
  heading: 0,
  latitude: 23.8103,
  longitude: 90.4125,
  altitude: 0,
  status: 'idle',
  mode: 'autonomous',
  navState: 'idle',
  targetLat: 23.812,
  targetLng: 90.415,
  wifiSignal: 0,
  connected: false,
  lastSeen: null as number | null,
  posX: 0,
  posY: 0,
  posH: 0,
  obstacles: [] as { a: number; d: number }[]
}

const commandHistory: { time: string; command: string; result: string }[] = []

export function logCommand(cmd: string, result: string) {
  const time = new Date().toLocaleTimeString()
  commandHistory.unshift({ time, command: cmd, result })
  if (commandHistory.length > 50) commandHistory.pop()
  prisma.log.create({
    data: {
      sessionId: 1,
      type: cmd === 'emergency' ? 'error' : 'info',
      message: `${cmd}: ${result}`
    }
  }).catch(() => {})
}

function handleCommand(cmd: string): string {
  let result = ''

  switch (cmd) {
    case 'start':
      vehicleStatus.status = 'running'
      result = 'Vehicle started'
      break
    case 'stop':
      vehicleStatus.status = 'idle'
      vehicleStatus.speed = 0
      result = 'Vehicle stopped'
      break
    case 'emergency':
      vehicleStatus.status = 'emergency'
      vehicleStatus.speed = 0
      result = 'EMERGENCY STOP'
      break
    case 'reset':
      vehicleStatus.status = 'idle'
      vehicleStatus.speed = 0
      result = 'System reset'
      break
    case 'mode_auto':
      vehicleStatus.mode = 'autonomous'
      vehicleStatus.speed = 0
      result = 'Autonomous mode'
      break
    case 'mode_manual':
      vehicleStatus.mode = 'manual'
      vehicleStatus.speed = 0
      result = 'Manual mode engaged'
      break
    case 'forward':
      if (vehicleStatus.mode !== 'manual') { result = 'Switch to MANUAL mode first'; break }
      vehicleStatus.status = 'running'
      result = 'Forward'
      break
    case 'backward':
      if (vehicleStatus.mode !== 'manual') { result = 'Switch to MANUAL mode first'; break }
      vehicleStatus.status = 'running'
      result = 'Backward'
      break
    case 'left':
      if (vehicleStatus.mode !== 'manual') { result = 'Switch to MANUAL mode first'; break }
      vehicleStatus.heading = (vehicleStatus.heading - 15 + 360) % 360
      result = `Turn left → ${vehicleStatus.heading.toFixed(0)}°`
      break
    case 'right':
      if (vehicleStatus.mode !== 'manual') { result = 'Switch to MANUAL mode first'; break }
      vehicleStatus.heading = (vehicleStatus.heading + 15) % 360
      result = `Turn right → ${vehicleStatus.heading.toFixed(0)}°`
      break
    case 'home':
      vehicleStatus.targetLat = 23.8103
      vehicleStatus.targetLng = 90.4125
      result = 'Home waypoint set'
      break
    default:
      if (cmd.startsWith('heading:')) {
        const [, deg] = cmd.split(':')
        vehicleStatus.heading = (parseFloat(deg) % 360 + 360) % 360
        result = `Heading set to ${vehicleStatus.heading.toFixed(0)}°`
      } else if (cmd.startsWith('throttle:')) {
        const [, val] = cmd.split(':')
        vehicleStatus.speed = Math.max(-1, Math.min(1, parseFloat(val)))
        result = `Throttle set to ${vehicleStatus.speed.toFixed(2)}`
      } else if (cmd.startsWith('goto:')) {
        const [, lat, lng] = cmd.split(':')
        vehicleStatus.targetLat = parseFloat(lat)
        vehicleStatus.targetLng = parseFloat(lng)
        result = `Waypoint set at (${lat}, ${lng})`
      } else {
        result = `Unknown: ${cmd}`
      }
  }

  logCommand(cmd, result)
  return result
}

export function registerVehicleIpc() {
  ipcMain.handle('vehicle:getTelemetry', async () => {
    return vehicleStatus
  })

  ipcMain.handle('vehicle:sendCommand', async (_event, cmd: string) => {
    const { sendToEsp32 } = require('./tcp')
    sendToEsp32(cmd)
    const message = handleCommand(cmd)
    return { success: true, message }
  })

  ipcMain.handle('vehicle:getCommandLog', async () => commandHistory)
  ipcMain.handle('vehicle:getStatus', () => vehicleStatus)
}
