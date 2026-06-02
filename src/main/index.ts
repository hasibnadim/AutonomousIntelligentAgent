import { app, BrowserWindow } from 'electron'
import { createWindow, registerWindowIpc } from './window'
import { registerVehicleIpc } from './vehicle'
import { registerDatabaseIpc, prisma } from './database'
import { startTcpServer } from './tcp'

app.whenReady().then(() => {
  createWindow()
  registerWindowIpc()
  registerVehicleIpc()
  registerDatabaseIpc()
  startTcpServer()

  prisma.session.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Default Session', status: 'idle' }
  }).catch(() => {})

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  await prisma.$disconnect()
})
