import { BrowserWindow } from 'electron'
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

export type ActivityEntry = {
  id: number
  userId: number | null
  userName: string
  action: string
  result: string
  detail: string
  createdAt: Date
}

/** Parse "320,890,410" → gap list in ms. Also accepts legacy "0,1,0,1" bits. */
export function parsePatternGaps(raw: string): number[] | null {
  const parts = String(raw ?? '')
    .trim()
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length < 2) return null

  const gaps = parts.map((p) => Number(p))
  if (gaps.some((g) => !Number.isFinite(g) || g < 0)) return null

  // Legacy bit pattern (only 0/1) — treat as relative rhythm units
  const onlyBits = gaps.every((g) => g === 0 || g === 1)
  if (onlyBits) {
    return gaps.map((g) => (g === 1 ? 1200 : 400))
  }

  // Real millisecond gaps — allow rapid military strikes (~80ms+)
  if (gaps.some((g) => g < 25 || g > 8000)) return null
  return gaps
}

/**
 * Knock match: same gap count, similar absolute timing, and similar rhythm.
 * (Relative-only matching was too loose — random taps could "match" and
 * clear the MCU fail counter.)
 */
export function patternsMatch(storedRaw: string, attemptRaw: string): boolean {
  const stored = parsePatternGaps(storedRaw)
  const attempt = parsePatternGaps(attemptRaw)
  if (!stored || !attempt) return false
  if (stored.length !== attempt.length) return false

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const meanS = mean(stored)
  const meanA = mean(attempt)
  if (meanS < 40 || meanA < 40) return false

  // Overall tempo must be similar (not just the rhythm shape).
  const tempoRatio = Math.abs(meanS - meanA) / Math.max(meanS, meanA)
  if (tempoRatio > 0.35) return false

  const REL_TOLERANCE = 0.28
  for (let i = 0; i < stored.length; i++) {
    const rs = stored[i] / meanS
    const ra = attempt[i] / meanA
    if (Math.abs(rs - ra) > REL_TOLERANCE) return false

    const absTol = Math.max(150, stored[i] * 0.4)
    if (Math.abs(stored[i] - attempt[i]) > absTol) return false
  }
  return true
}

function broadcastActivity(entry: ActivityEntry) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('activity:new', entry)
  }
}

export async function logActivity(data: {
  userId?: number | null
  userName?: string
  action: string
  result: string
  detail?: string
}): Promise<ActivityEntry> {
  const row = await prisma.activityLog.create({
    data: {
      userId: data.userId ?? null,
      userName: data.userName ?? '',
      action: data.action,
      result: data.result,
      detail: data.detail ?? ''
    }
  })
  const entry: ActivityEntry = {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    action: row.action,
    result: row.result,
    detail: row.detail,
    createdAt: row.createdAt
  }
  broadcastActivity(entry)
  return entry
}

export async function listActivity(search = ''): Promise<ActivityEntry[]> {
  const q = search.trim()
  const rows = await prisma.activityLog.findMany({
    where: q
      ? {
          OR: [
            { userName: { contains: q } },
            { action: { contains: q } },
            { result: { contains: q } },
            { detail: { contains: q } },
            ...(Number.isInteger(Number(q)) ? [{ userId: Number(q) }] : [])
          ]
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 300
  })
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    action: row.action,
    result: row.result,
    detail: row.detail,
    createdAt: row.createdAt
  }))
}

export async function lookupBiometric(userId: number): Promise<LookupResult> {
  if (!Number.isInteger(userId) || userId <= 0) {
    await logActivity({
      userId,
      action: 'LOOKUP',
      result: 'FAIL',
      detail: 'INVALID_USER_ID'
    })
    return { ok: false, error: 'INVALID_USER_ID' }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    await logActivity({
      userId,
      userName: `user-${userId}`,
      action: 'LOOKUP',
      result: 'NOT_FOUND',
      detail: 'User does not exist'
    })
    return { ok: false, error: 'NOT_FOUND' }
  }

  const publicUser = toPublicUser(user)
  const label = user.name || user.username || `user-${user.id}`
  await logActivity({
    userId: user.id,
    userName: label,
    action: 'LOOKUP',
    result: 'SUCCESS',
    detail: `status=${publicUser.biometricStatus}`
  })

  return {
    ok: true,
    userId: user.id,
    status: publicUser.biometricStatus,
    username: label
  }
}

export async function setBiometricPattern(userId: number, patternRaw: string): Promise<SetResult> {
  const gaps = parsePatternGaps(patternRaw)
  if (!Number.isInteger(userId) || userId <= 0) {
    await logActivity({ userId, action: 'SET', result: 'FAIL', detail: 'INVALID_USER_ID' })
    return { ok: false, error: 'INVALID_USER_ID' }
  }
  if (!gaps) {
    await logActivity({
      userId,
      action: 'SET',
      result: 'FAIL',
      detail: 'Invalid pattern (need >= 3 gaps in ms)'
    })
    return { ok: false, error: 'PATTERN_INVALID' }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    await logActivity({
      userId,
      userName: `user-${userId}`,
      action: 'SET',
      result: 'NOT_FOUND',
      detail: 'User does not exist'
    })
    return { ok: false, error: 'NOT_FOUND' }
  }

  const normalized = gaps.join(',')
  const label = user.name || user.username || `user-${user.id}`

  await prisma.user.update({
    where: { id: userId },
    data: { biometricPattern: normalized }
  })

  await logActivity({
    userId: user.id,
    userName: label,
    action: 'SET',
    result: 'SUCCESS',
    detail: `enrolled gaps=${normalized}`
  })

  return { ok: true, userId, status: 'GET' }
}

export async function verifyBiometricPattern(
  userId: number,
  patternRaw: string
): Promise<VerifyResult> {
  if (!Number.isInteger(userId) || userId <= 0) {
    await logActivity({ userId, action: 'GET', result: 'FAIL', detail: 'INVALID_USER_ID' })
    return { ok: false, error: 'INVALID_USER_ID' }
  }

  const attemptGaps = parsePatternGaps(patternRaw)
  if (!attemptGaps) {
    await logActivity({
      userId,
      action: 'GET',
      result: 'FAIL',
      detail: 'Invalid attempt pattern'
    })
    return { ok: false, error: 'PATTERN_INVALID' }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    await logActivity({
      userId,
      userName: `user-${userId}`,
      action: 'GET',
      result: 'NOT_FOUND',
      detail: 'User does not exist'
    })
    return { ok: false, error: 'NOT_FOUND' }
  }

  const label = user.name || user.username || `user-${user.id}`
  if (!user.biometricPattern) {
    await logActivity({
      userId: user.id,
      userName: label,
      action: 'GET',
      result: 'FAIL',
      detail: 'PATTERN_NOT_SET'
    })
    return { ok: false, error: 'PATTERN_NOT_SET' }
  }

  // If stored value looks like a bcrypt hash from old builds, force re-enroll
  if (user.biometricPattern.startsWith('$2')) {
    await logActivity({
      userId: user.id,
      userName: label,
      action: 'GET',
      result: 'FAIL',
      detail: 'Legacy hash — reset biometric and re-enroll'
    })
    return { ok: false, error: 'PATTERN_LEGACY' }
  }

  const matched = patternsMatch(user.biometricPattern, attemptGaps.join(','))
  await logActivity({
    userId: user.id,
    userName: label,
    action: 'GET',
    result: matched ? 'SUCCESS' : 'FAIL',
    detail: matched
      ? `verified attempt=${attemptGaps.join(',')}`
      : `mismatch stored=${user.biometricPattern} attempt=${attemptGaps.join(',')}`
  })

  return { ok: true, verified: matched ? 1 : 0 }
}
