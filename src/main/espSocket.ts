import net from 'net'
import { BrowserWindow, ipcMain } from 'electron'
import { lookupBiometric, setBiometricPattern, verifyBiometricPattern } from './biometric'

const PORT = 9000
const MAX_LOGS = 200

export type EspLogEntry = {
  id: number
  time: string
  type: 'info' | 'rx' | 'tx' | 'error'
  remote: string
  message: string
}

type EspCommand =
  | { cmd: 'LOOKUP'; userId: number }
  | { cmd: 'SET'; userId: number; pattern: string }
  | { cmd: 'GET'; userId: number; pattern: string }

const clients = new Set<net.Socket>()
const logs: EspLogEntry[] = []
let logSeq = 0
let listening = false

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

function pushLog(type: EspLogEntry['type'], remote: string, message: string) {
  const entry: EspLogEntry = {
    id: ++logSeq,
    time: new Date().toISOString(),
    type,
    remote,
    message
  }
  logs.unshift(entry)
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS
  broadcast('esp:log', entry)
  return entry
}

function emitStatus() {
  const status = getEspStatus()
  broadcast('esp:status', status)
  return status
}

export function getEspStatus() {
  const remotes = [...clients].map((socket) => `${socket.remoteAddress}:${socket.remotePort}`)
  return {
    listening,
    port: PORT,
    connected: clients.size > 0,
    clientCount: clients.size,
    clients: remotes
  }
}

export function getEspLogs() {
  return logs
}

export function clearEspLogs() {
  logs.length = 0
  broadcast('esp:logsCleared', true)
  return true
}

function parseLine(raw: string): EspCommand | null {
  const line = raw.trim()
  if (!line) return null

  const parts = line.split(':')
  const cmd = parts[0]?.toUpperCase()
  const userId = Number(parts[1])
  if (cmd === 'LOOKUP') return { cmd: 'LOOKUP', userId }
  if (cmd === 'SET' && parts.length === 3) return { cmd: 'SET', userId, pattern: parts[2] }
  if (cmd === 'GET' && parts.length === 3) return { cmd: 'GET', userId, pattern: parts[2] }
  return null
}

async function handleCommand(cmd: EspCommand): Promise<string> {
  if (cmd.cmd === 'LOOKUP') {
    const result = await lookupBiometric(cmd.userId)
    return result.ok
      ? `LOOKUP:${result.userId}:${result.status}`
      : `ERROR:${result.error}`
  }

  if (cmd.cmd === 'SET') {
    const result = await setBiometricPattern(cmd.userId, cmd.pattern)
    return result.ok
      ? `SET:${result.userId}:OK`
      : `ERROR:${result.error}`
  }

  const result = await verifyBiometricPattern(cmd.userId, cmd.pattern)
  return result.ok
    ? `GET:${cmd.userId}:${result.verified}`
    : `ERROR:${result.error}`
}

function writeLine(socket: net.Socket, remote: string, response: string) {
  socket.write(`${response}\n`)
  pushLog('tx', remote, response)
}

export function registerEspIpc() {
  ipcMain.handle('esp:getStatus', () => getEspStatus())
  ipcMain.handle('esp:getLogs', () => getEspLogs())
  ipcMain.handle('esp:clearLogs', () => clearEspLogs())
}

export function startEspSocketServer() {
  const server = net.createServer((socket) => {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`
    clients.add(socket)
    pushLog('info', remote, 'CONNECTED')
    emitStatus()

    let buffer = ''

    socket.on('data', (chunk) => {
      const raw = chunk.toString('utf8')
      buffer += raw

      // Log raw chunk traffic for the dashboard
      pushLog('rx', remote, raw.replace(/\r/g, '\\r').replace(/\n/g, '\\n'))

      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)

        void (async () => {
          if (!line.trim()) return

          const cmd = parseLine(line)
          if (!cmd) {
            writeLine(socket, remote, 'ERROR:BAD_REQUEST')
            return
          }

          try {
            const response = await handleCommand(cmd)
            writeLine(socket, remote, response)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'SERVER_ERROR'
            writeLine(socket, remote, `ERROR:${message.replace(/:/g, '_')}`)
          }
        })()

        newline = buffer.indexOf('\n')
      }
    })

    socket.on('close', () => {
      clients.delete(socket)
      pushLog('info', remote, 'DISCONNECTED')
      emitStatus()
    })

    socket.on('error', (err) => {
      pushLog('error', remote, err.message)
    })
  })

  server.listen(PORT, '0.0.0.0', () => {
    listening = true
    pushLog('info', 'server', `LISTENING on 0.0.0.0:${PORT}`)
    emitStatus()
    console.log(`[ESP] Biometric socket listening on 0.0.0.0:${PORT}`)
  })

  server.on('error', (err) => {
    listening = false
    pushLog('error', 'server', err.message)
    emitStatus()
    console.error('[ESP] Failed to start socket server:', err)
  })

  return server
}
