import bcrypt from 'bcryptjs'
import { prisma, toPublicUser, type BiometricStatus } from './database'

export type LookupResult =
  | { ok: true; userId: number; status: BiometricStatus; username: string }
  | { ok: false; error: string }

export type SetResult =
  | { ok: true; userId: number; status: 'GET' }
  | { ok: false; error: string }

export type VerifyResult =
  | { ok: true; verified: 0 | 1 }
  | { ok: false; error: string }

export async function lookupBiometric(userId: number): Promise<LookupResult> {
  if (!Number.isInteger(userId) || userId <= 0) {
    return { ok: false, error: 'INVALID_USER_ID' }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { ok: false, error: 'NOT_FOUND' }

  const publicUser = toPublicUser(user)
  return {
    ok: true,
    userId: user.id,
    status: publicUser.biometricStatus,
    username: user.username
  }
}

export async function setBiometricPattern(userId: number, patternRaw: string): Promise<SetResult> {
  const pattern = String(patternRaw ?? '').trim()
  if (!Number.isInteger(userId) || userId <= 0) return { ok: false, error: 'INVALID_USER_ID' }
  if (!pattern) return { ok: false, error: 'EMPTY_PATTERN' }
  if (pattern.length < 4) return { ok: false, error: 'PATTERN_TOO_SHORT' }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { ok: false, error: 'NOT_FOUND' }

  const biometricPattern = await bcrypt.hash(pattern, 10)
  await prisma.user.update({
    where: { id: userId },
    data: { biometricPattern }
  })

  return { ok: true, userId, status: 'GET' }
}

export async function verifyBiometricPattern(
  userId: number,
  patternRaw: string
): Promise<VerifyResult> {
  const pattern = String(patternRaw ?? '').trim()
  if (!Number.isInteger(userId) || userId <= 0) return { ok: false, error: 'INVALID_USER_ID' }
  if (!pattern) return { ok: false, error: 'EMPTY_PATTERN' }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { ok: false, error: 'NOT_FOUND' }
  if (!user.biometricPattern) return { ok: false, error: 'PATTERN_NOT_SET' }

  const matched = await bcrypt.compare(pattern, user.biometricPattern)
  return { ok: true, verified: matched ? 1 : 0 }
}
