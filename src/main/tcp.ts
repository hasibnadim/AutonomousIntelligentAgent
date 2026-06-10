import { getMainWindow } from './window'
import { vehicleStatus } from './vehicle'

let espSocket: any = null

export function sendToEsp32(cmd: string) {
  if (espSocket && espSocket.writable) {
    espSocket.write(cmd + '\n')
  }
}

function applyTelemetry(d: any) {
  // Old format fields
  if (d.speed !== undefined) vehicleStatus.speed = d.speed
  if (d.batteryLevel !== undefined) vehicleStatus.batteryLevel = d.batteryLevel
  if (d.batteryVoltage !== undefined) vehicleStatus.batteryVoltage = d.batteryVoltage
  if (d.temperature !== undefined) vehicleStatus.temperature = d.temperature
  if (d.flameDetected !== undefined) vehicleStatus.flameDetected = d.flameDetected
  if (d.ultrasonicLeft !== undefined) vehicleStatus.ultrasonicLeft = d.ultrasonicLeft
  if (d.ultrasonicRight !== undefined) vehicleStatus.ultrasonicRight = d.ultrasonicRight
  if (d.heading !== undefined) vehicleStatus.heading = d.heading
  if (d.status !== undefined) vehicleStatus.status = d.status
  if (d.mode !== undefined) vehicleStatus.mode = d.mode
  if (d.wifiSignal !== undefined) vehicleStatus.wifiSignal = d.wifiSignal
  if (d.navState !== undefined) vehicleStatus.navState = d.navState

  // New ESP32 format fields
  if (d.spd !== undefined) vehicleStatus.speed = d.spd
  if (d.temp !== undefined) vehicleStatus.temperature = d.temp
  if (d.flame !== undefined) vehicleStatus.flameDetected = d.flame
  if (d.ulL !== undefined) vehicleStatus.ultrasonicLeft = d.ulL
  if (d.ulR !== undefined) vehicleStatus.ultrasonicRight = d.ulR
  if (d.hdg !== undefined) vehicleStatus.heading = d.hdg
  if (d.sts !== undefined) vehicleStatus.status = d.sts
  if (d.wifi !== undefined) vehicleStatus.wifiSignal = d.wifi
  if (d.nav !== undefined) vehicleStatus.navState = d.nav

  if (d.pos) {
    if (d.pos.x !== undefined) vehicleStatus.posX = d.pos.x
    if (d.pos.y !== undefined) vehicleStatus.posY = d.pos.y
    if (d.pos.h !== undefined) vehicleStatus.posH = d.pos.h
  }

  if (d.obstacles && Array.isArray(d.obstacles)) {
    vehicleStatus.obstacles = d.obstacles
  }

  vehicleStatus.connected = true
  vehicleStatus.lastSeen = Date.now()
  getMainWindow()?.webContents.send('vehicle:liveData', vehicleStatus)
}

export function startTcpServer() {
  try {
    const net = require('net')
    const server = net.createServer((socket: any) => {
      espSocket = socket
      const addr = `${socket.remoteAddress}:${socket.remotePort}`
      console.log(`[TCP] ESP32 connected from ${addr}`)
      vehicleStatus.connected = true
      vehicleStatus.lastSeen = Date.now()
      getMainWindow()?.webContents.send('vehicle:liveData', vehicleStatus)

      socket.on('data', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString().trim())
          const d = msg.data || msg
          applyTelemetry(d)
        } catch { /* ignore malformed */ }
      })

      socket.on('close', () => {
        console.log(`[TCP] ESP32 disconnected from ${addr}`)
        espSocket = null
        vehicleStatus.connected = false
        vehicleStatus.status = 'offline'
        vehicleStatus.speed = 0
        vehicleStatus.ultrasonicLeft = 0
        vehicleStatus.ultrasonicRight = 0
        getMainWindow()?.webContents.send('vehicle:liveData', vehicleStatus)
      })

      socket.on('error', (err: any) => {
        console.warn(`[TCP] Socket error: ${err.message}`)
      })
    })

    server.listen(9000, '0.0.0.0', () => console.log('[TCP] Server listening on port 9000'))
    server.on('error', (err: any) => console.warn('[TCP] Server error:', err.message))
  } catch {
    console.log('[TCP] Server not available')
  }
}
