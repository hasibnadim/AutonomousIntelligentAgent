import { ipcMain } from 'electron'
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  login,
  logout,
  me,
  requireAdmin,
  requireAuth,
  resetBiometric,
  updateUser
} from './userService'

let ipcToken: string | null = null

export { seedDefaultAdmin } from './userService'

export function registerAuthIpc() {
  ipcMain.handle('auth:login', async (_event, data: { username: string; password: string }) => {
    const result = await login(data.username, data.password)
    ipcToken = result.token
    return result.user
  })

  ipcMain.handle('auth:logout', async () => {
    logout(ipcToken)
    ipcToken = null
    return true
  })

  ipcMain.handle('auth:me', async () => me(ipcToken))

  ipcMain.handle('users:list', async () => {
    requireAdmin(ipcToken)
    return listUsers()
  })

  ipcMain.handle(
    'users:create',
    async (
      _event,
      data: { username?: string; email?: string; password?: string; name?: string; role?: string }
    ) => {
      requireAdmin(ipcToken)
      return createUser(data)
    }
  )

  ipcMain.handle(
    'users:update',
    async (
      _event,
      data: {
        id: number
        username?: string
        email?: string
        name?: string
        role?: string
        password?: string
      }
    ) => {
      const actor = requireAuth(ipcToken)
      return updateUser(actor, data)
    }
  )

  ipcMain.handle('users:delete', async (_event, id: number) => {
    const actor = requireAdmin(ipcToken)
    return deleteUser(actor, id)
  })

  ipcMain.handle('users:get', async (_event, id: number) => {
    requireAdmin(ipcToken)
    return getUser(id)
  })

  ipcMain.handle('users:resetBiometric', async (_event, id: number) => {
    requireAdmin(ipcToken)
    return resetBiometric(id)
  })
}
