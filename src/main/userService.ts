import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma, toPublicUser, type PublicUser } from './database'

const sessions = new Map<string, PublicUser>()

export function getSessionUser(token?: string | null): PublicUser | null {
  if (!token) return null
  return sessions.get(token) ?? null
}

export function requireAuth(token?: string | null): PublicUser {
  const user = getSessionUser(token)
  if (!user) throw new Error('Not authenticated')
  return user
}

export function requireAdmin(token?: string | null): PublicUser {
  const user = requireAuth(token)
  if (user.role !== 'ADMIN') throw new Error('Admin access required')
  return user
}

function createToken(user: PublicUser): string {
  const token = randomBytes(24).toString('hex')
  sessions.set(token, user)
  return token
}

export async function login(
  usernameRaw: string,
  password: string
): Promise<{ token: string; user: PublicUser }> {
  const username = usernameRaw?.trim()
  if (!username || !password) throw new Error('Username and password are required')

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !user.passwordHash) throw new Error('Invalid username or password')
  if (user.role !== 'ADMIN') throw new Error('Only admins can sign in')

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) throw new Error('Invalid username or password')

  const publicUser = toPublicUser(user)
  const token = createToken(publicUser)
  return { token, user: publicUser }
}

export function logout(token?: string | null): boolean {
  if (token) sessions.delete(token)
  return true
}

export function me(token?: string | null): PublicUser | null {
  return getSessionUser(token)
}

export async function listUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
  return users.map(toPublicUser)
}

export async function getUser(id: number): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) throw new Error('User not found')
  return toPublicUser(user)
}

export async function createUser(data: {
  username?: string
  email?: string
  password?: string
  name?: string
  role?: string
}): Promise<PublicUser> {
  const role = data.role === 'ADMIN' ? 'ADMIN' : 'USER'
  const name = data.name?.trim() ?? ''

  if (role === 'USER') {
    if (!name) throw new Error('Name is required for users')
    const user = await prisma.user.create({
      data: {
        name,
        role: 'USER',
        username: null,
        email: null,
        passwordHash: null,
        biometricPattern: null
      }
    })
    return toPublicUser(user)
  }

  const username = data.username?.trim()
  const email = data.email?.trim().toLowerCase()
  const password = data.password ?? ''

  if (!username || !email || !password) {
    throw new Error('Username, email, and password are required for admins')
  }
  if (password.length < 6) throw new Error('Password must be at least 6 characters')

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] }
  })
  if (existing) throw new Error('Username or email already exists')

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { username, email, name: name || username, role: 'ADMIN', passwordHash }
  })
  return toPublicUser(user)
}

export async function updateUser(
  actor: PublicUser,
  data: {
    id: number
    username?: string
    email?: string
    name?: string
    role?: string
    password?: string
  }
): Promise<PublicUser> {
  const isAdmin = actor.role === 'ADMIN'
  if (!isAdmin && actor.id !== data.id) throw new Error('Cannot update another user')

  const target = await prisma.user.findUnique({ where: { id: data.id } })
  if (!target) throw new Error('User not found')

  const nextRole =
    data.role !== undefined ? (data.role === 'ADMIN' ? 'ADMIN' : 'USER') : target.role

  if (data.role !== undefined && !isAdmin) throw new Error('Only admins can change roles')

  const update: {
    username?: string | null
    email?: string | null
    name?: string
    role?: string
    passwordHash?: string | null
  } = {}

  if (data.name !== undefined) {
    const name = data.name.trim()
    if (!name) throw new Error('Name cannot be empty')
    update.name = name
  }

  if (nextRole === 'USER') {
    update.role = 'USER'
    update.username = null
    update.email = null
    update.passwordHash = null
  } else {
    update.role = 'ADMIN'
    const username = (data.username ?? target.username ?? '').trim()
    const email = (data.email ?? target.email ?? '').trim().toLowerCase()
    if (!username || !email) throw new Error('Username and email are required for admins')
    update.username = username
    update.email = email

    if (data.password) {
      if (data.password.length < 6) throw new Error('Password must be at least 6 characters')
      update.passwordHash = await bcrypt.hash(data.password, 10)
    } else if (!target.passwordHash) {
      throw new Error('Password is required when promoting to admin')
    }
  }

  try {
    const user = await prisma.user.update({ where: { id: data.id }, data: update })
    const publicUser = toPublicUser(user)

    for (const [token, sessionUser] of sessions.entries()) {
      if (sessionUser.id === publicUser.id) {
        if (publicUser.role !== 'ADMIN') sessions.delete(token)
        else sessions.set(token, publicUser)
      }
    }

    return publicUser
  } catch {
    throw new Error('Username or email already exists')
  }
}

export async function resetBiometric(id: number): Promise<PublicUser> {
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw new Error('User not found')

  const user = await prisma.user.update({
    where: { id },
    data: { biometricPattern: null }
  })
  return toPublicUser(user)
}

export async function deleteUser(actor: PublicUser, id: number): Promise<boolean> {
  if (actor.id === id) throw new Error('Cannot delete your own account')

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw new Error('User not found')

  await prisma.user.delete({ where: { id } })

  for (const [token, sessionUser] of sessions.entries()) {
    if (sessionUser.id === id) sessions.delete(token)
  }

  return true
}

export async function seedDefaultAdmin() {
  const passwordHash = await bcrypt.hash('admin123', 10)
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: 'admin' }, { email: 'admin@local' }]
    }
  })

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: 'admin',
        email: 'admin@local',
        name: existing.name || 'Administrator',
        role: 'ADMIN',
        passwordHash
      }
    })
    return
  }

  await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@local',
      name: 'Administrator',
      role: 'ADMIN',
      passwordHash
    }
  })
}
