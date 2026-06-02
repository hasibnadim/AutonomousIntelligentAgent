import { ipcMain } from 'electron'
import { prisma } from './database'

export let vehicleStatus = {
  speed: 0,
  batteryLevel: 85,
  batteryVoltage: 12.4,
  temperature: 32,
  flameDetected: false,
  ultrasonicDistance: 120,
  heading: 0,
  latitude: 23.8103,
  longitude: 90.4125,
  altitude: 12,
  status: 'idle',
  mode: 'autonomous',
  targetLat: 23.812,
  targetLng: 90.415,
  wifiSignal: -45
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

function simulateTelemetry() {
  if (vehicleStatus.mode === 'autonomous' && vehicleStatus.status === 'running') {
    const dLat = vehicleStatus.targetLat - vehicleStatus.latitude
    const dLng = vehicleStatus.targetLng - vehicleStatus.longitude
    const dist = Math.sqrt(dLat * dLat + dLng * dLng)
    if (dist > 0.0005) {
      vehicleStatus.heading = (Math.atan2(dLng, dLat) * 180) / Math.PI
      if (vehicleStatus.heading < 0) vehicleStatus.heading += 360
      vehicleStatus.latitude += (dLat / dist) * 0.0001
      vehicleStatus.longitude += (dLng / dist) * 0.0001
      vehicleStatus.speed = 0.8 + Math.random() * 0.4
    } else {
      vehicleStatus.speed = 0
      vehicleStatus.status = 'idle'
    }
  }

  if (vehicleStatus.mode === 'manual' && vehicleStatus.status === 'running' && Math.abs(vehicleStatus.speed) > 0.01) {
    const rad = vehicleStatus.heading * Math.PI / 180
    const moveSpeed = vehicleStatus.speed * 0.00015
    vehicleStatus.latitude += Math.cos(rad) * moveSpeed
    vehicleStatus.longitude += Math.sin(rad) * moveSpeed
  }

  vehicleStatus.temperature = 30 + Math.random() * 8
  vehicleStatus.flameDetected = Math.random() < 0.05
  vehicleStatus.ultrasonicDistance = 20 + Math.random() * 180
  vehicleStatus.batteryLevel = Math.max(5, vehicleStatus.batteryLevel - 0.01)
  vehicleStatus.wifiSignal = Math.max(-90, Math.min(-30, vehicleStatus.wifiSignal + (Math.random() - 0.5) * 4))
}

function handleCommand(cmd: string): string {
  let result = ''

  switch (cmd) {
    case 'start':
      vehicleStatus.status = 'running'
      vehicleStatus.speed = 0.5
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
    case 'forward': {
      if (vehicleStatus.mode === 'manual') {
        vehicleStatus.status = 'running'
        vehicleStatus.speed = 0.8
        const rad = vehicleStatus.heading * Math.PI / 180
        vehicleStatus.latitude += Math.cos(rad) * 0.0001
        vehicleStatus.longitude += Math.sin(rad) * 0.0001
        result = 'Move forward'
      } else { result = 'Switch to MANUAL mode first' }
      break
    }
    case 'backward': {
      if (vehicleStatus.mode === 'manual') {
        vehicleStatus.status = 'running'
        vehicleStatus.speed = 0.5
        const rad = vehicleStatus.heading * Math.PI / 180
        vehicleStatus.latitude -= Math.cos(rad) * 0.0001
        vehicleStatus.longitude -= Math.sin(rad) * 0.0001
        result = 'Move backward'
      } else { result = 'Switch to MANUAL mode first' }
      break
    }
    case 'left':
      if (vehicleStatus.mode === 'manual') {
        vehicleStatus.heading = (vehicleStatus.heading - 15 + 360) % 360
        result = `Turn left → heading ${vehicleStatus.heading.toFixed(0)}°`
      } else { result = 'Switch to MANUAL mode first' }
      break
    case 'right':
      if (vehicleStatus.mode === 'manual') {
        vehicleStatus.heading = (vehicleStatus.heading + 15) % 360
        result = `Turn right → heading ${vehicleStatus.heading.toFixed(0)}°`
      } else { result = 'Switch to MANUAL mode first' }
      break
    case 'mode_auto':
      vehicleStatus.mode = 'autonomous'
      vehicleStatus.targetLat = 23.812
      vehicleStatus.targetLng = 90.415
      result = 'Autonomous mode — navigating to waypoint'
      break
    case 'mode_manual':
      vehicleStatus.mode = 'manual'
      vehicleStatus.speed = 0
      result = 'Manual mode engaged'
      break
    case 'home':
      vehicleStatus.targetLat = 23.8103
      vehicleStatus.targetLng = 90.4125
      if (vehicleStatus.mode === 'autonomous') {
        vehicleStatus.status = 'running'
        result = 'Returning to home position'
      } else { result = 'Home waypoint set' }
      break
    default:
      if (cmd.startsWith('goto:')) {
        const [, lat, lng] = cmd.split(':')
        vehicleStatus.targetLat = parseFloat(lat)
        vehicleStatus.targetLng = parseFloat(lng)
        if (vehicleStatus.mode === 'autonomous') {
          vehicleStatus.status = 'running'
          result = `Navigating to (${lat}, ${lng})`
        } else { result = `Waypoint set at (${lat}, ${lng})` }
      } else if (cmd.startsWith('throttle:')) {
        const [, val] = cmd.split(':')
        vehicleStatus.speed = Math.max(-1, Math.min(1, parseFloat(val)))
        if (Math.abs(vehicleStatus.speed) > 0.01) vehicleStatus.status = 'running'
        else vehicleStatus.status = 'idle'
        result = `Throttle set to ${vehicleStatus.speed.toFixed(2)}`
      } else if (cmd.startsWith('heading:')) {
        const [, deg] = cmd.split(':')
        vehicleStatus.heading = (parseFloat(deg) % 360 + 360) % 360
        result = `Heading set to ${vehicleStatus.heading.toFixed(0)}°`
      } else {
        result = `Unknown: ${cmd}`
      }
  }

  logCommand(cmd, result)
  return result
}

export function registerVehicleIpc() {
  ipcMain.handle('vehicle:getTelemetry', async () => {
    simulateTelemetry()
    return vehicleStatus
  })

  ipcMain.handle('vehicle:sendCommand', async (_event, cmd: string) => {
    const message = handleCommand(cmd)
    return { success: true, message }
  })

  ipcMain.handle('vehicle:getCommandLog', async () => commandHistory)
  ipcMain.handle('vehicle:getStatus', () => vehicleStatus)
}
