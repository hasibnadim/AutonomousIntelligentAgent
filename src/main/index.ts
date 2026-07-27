import { app, BrowserWindow } from 'electron'
import { createWindow, registerWindowIpc } from './window'
import { prisma } from './database'
import { registerAuthIpc, seedDefaultAdmin } from './auth'
import { registerEspIpc, startEspSocketServer } from './espSocket'

app.whenReady().then(async () => {
  createWindow()
  registerWindowIpc()
  registerAuthIpc()
  registerEspIpc()
  startEspSocketServer()

  try {
    await seedDefaultAdmin()
  } catch (err) {
    console.error('Failed to seed admin:', err)
  }

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
