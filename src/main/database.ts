import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import { join } from 'path'

const dbPath = app.isPackaged
  ? join(process.resourcesPath, 'prisma', 'dev.db')
  : join(app.getAppPath(), 'prisma', 'dev.db')

process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`

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

export type BiometricStatus = 'SET' | 'GET'

export type PublicUser = {
  id: number
  username: string | null
  email: string | null
  name: string
  role: string
  biometricStatus: BiometricStatus
  createdAt: Date
  updatedAt: Date
}

export function toPublicUser(user: {
  id: number
  username: string | null
  email: string | null
  name: string
  role: string
  biometricPattern?: string | null
  createdAt: Date
  updatedAt: Date
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    biometricStatus: user.biometricPattern ? 'GET' : 'SET',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}
