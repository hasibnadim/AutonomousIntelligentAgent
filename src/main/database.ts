import { PrismaClient } from '@prisma/client'
import { ipcMain, app } from 'electron'
import { join } from 'path'

const dbPath = app.isPackaged
  ? join(process.resourcesPath, 'prisma', 'dev.db')
  : join(__dirname, '..', '..', '..', 'prisma', 'dev.db')

process.env.DATABASE_URL = `file:${dbPath}`

if (app.isPackaged) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = join(
    process.resourcesPath, 'app.asar.unpacked',
    'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node'
  )
} else {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = join(
    app.getAppPath(), 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node'
  )
}

export const prisma = new PrismaClient()

export function registerDatabaseIpc() {
  ipcMain.handle('db:getWaypoints', async () => {
    try { return await prisma.waypoint.findMany({ where: { sessionId: 1 }, orderBy: { createdAt: 'asc' } }) }
    catch { return [] }
  })

  ipcMain.handle('db:addWaypoint', async (_event, data: { lat: number; lng: number; label: string }) => {
    return prisma.waypoint.create({ data: { sessionId: 1, ...data } })
  })

  ipcMain.handle('db:deleteWaypoint', async (_event, id: number) => {
    return prisma.waypoint.delete({ where: { id } })
  })

  ipcMain.handle('db:getSessions', async () => {
    return prisma.session.findMany({ orderBy: { startedAt: 'desc' } })
  })

  ipcMain.handle('db:getLogs', async (_event, sessionId: number) => {
    return prisma.log.findMany({ where: { sessionId }, orderBy: { createdAt: 'desc' }, take: 50 })
  })
}
