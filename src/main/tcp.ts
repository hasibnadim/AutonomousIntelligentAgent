import { getMainWindow } from './window'
import { vehicleStatus } from './vehicle'

export function startTcpServer() {
  try {
    const net = require('net')
    const server = net.createServer((socket: any) => {
      const addr = `${socket.remoteAddress}:${socket.remotePort}`
      console.log(`[TCP] ESP32 connected from ${addr}`)
      socket.write(JSON.stringify({ type: 'hello', version: '1.0' }) + '\n')

      socket.on('data', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString().trim())
          if (msg.type === 'telemetry') {
            Object.assign(vehicleStatus, msg.data)
            getMainWindow()?.webContents.send('vehicle:liveData', vehicleStatus)
          }
        } catch { /* ignore malformed */ }
      })

      socket.on('close', () => console.log(`[TCP] ESP32 disconnected from ${addr}`))
    })

    server.listen(9000, '0.0.0.0', () => console.log('[TCP] Server listening on port 9000'))
    server.on('error', (err: any) => console.warn('[TCP] Server error:', err.message))
  } catch {
    console.log('[TCP] Server not available — running in simulation mode')
  }
}
