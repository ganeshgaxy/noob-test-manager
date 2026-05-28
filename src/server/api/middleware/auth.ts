import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getCookie } from 'hono/cookie'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  users,
  sessions,
  apiTokens,
  appMembers,
  spaceMembers,
  spaces,
  appGroupAccess,
  spaceGroupAccess,
  groupMembers,
} from '../../db/schema.js'
import { hashToken, isExpired } from '../../auth/crypto.js'

export type UserRole = 'super_admin' | 'member'
export type ResourceRole = 'admin' | 'member' | 'viewer'

const ROLE_RANK: Record<ResourceRole, number> = { admin: 3, member: 2, viewer: 1 }

function hasRole(actual: ResourceRole, required: ResourceRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required]
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

/**
 * Reads session cookie OR Authorization: Bearer <token> header.
 * On success, sets `user` in context. Returns 401 if neither is valid.
 */
export async function requireAuth(c: Context, next: Next) {
  // 1. Try session cookie
  const sid = getCookie(c, 'sid')
  if (sid) {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sid))
    if (session && !isExpired(session.expiresAt)) {
      const [user] = await db.select().from(users).where(eq(users.id, session.userId))
      if (user && user.isActive) {
        c.set('user', user)
        return next()
      }
    }
  }

  // 2. Try Bearer token
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const raw = authHeader.slice(7)
    const tokenHash = hashToken(raw)
    const [token] = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash))
    if (token && (!token.expiresAt || !isExpired(token.expiresAt))) {
      const [user] = await db.select().from(users).where(eq(users.id, token.userId))
      if (user && user.isActive) {
        // Update last_used_at asynchronously — don't block the request
        db.update(apiTokens)
          .set({ lastUsedAt: new Date().toISOString() })
          .where(eq(apiTokens.id, token.id))
          .catch(() => {})
        c.set('user', user)
        return next()
      }
    }
  }

  return c.json({ error: 'authentication required' }, 401)
}

/** Optional auth — attaches user if credentials are valid, but doesn't block unauthenticated requests. */
export async function optionalAuth(c: Context, next: Next) {
  const sid = getCookie(c, 'sid')
  if (sid) {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sid))
    if (session && !isExpired(session.expiresAt)) {
      const [user] = await db.select().from(users).where(eq(users.id, session.userId))
      if (user && user.isActive) c.set('user', user)
    }
  }
  return next()
}

// ─── Permission helpers ───────────────────────────────────────────────────────

type AuthUser = typeof users.$inferSelect

/** Throws 403 HTTPException if the user doesn't have at least `required` role on the app. */
export async function requireAppRole(
  c: Context,
  appId: number,
  required: ResourceRole
): Promise<void> {
  const user = c.get('user') as AuthUser
  if (!user) {
    c.res = c.json({ error: 'authentication required' }, 401) as Response
    return
  }
  if (user.globalRole === 'super_admin') return // super_admin bypasses all checks

  // 1. Check direct app membership
  const [directMembership] = await db
    .select()
    .from(appMembers)
    .where(and(eq(appMembers.appId, appId), eq(appMembers.userId, user.id)))
  if (directMembership && hasRole(directMembership.role, required)) return

  // 2. Check group-based app access — take the highest role granted by any group
  const groupAccess = await db
    .select({ role: appGroupAccess.role })
    .from(appGroupAccess)
    .innerJoin(groupMembers, eq(appGroupAccess.groupId, groupMembers.groupId))
    .where(and(eq(appGroupAccess.appId, appId), eq(groupMembers.userId, user.id)))

  const bestGroupRole = groupAccess.reduce<ResourceRole | null>((best, row) => {
    if (!best) return row.role
    return ROLE_RANK[row.role] > ROLE_RANK[best] ? row.role : best
  }, null)

  if (bestGroupRole && hasRole(bestGroupRole, required)) return

  throw new HTTPException(403, { message: 'forbidden' })
}

/**
 * Checks space membership first (direct then group), then falls back to app-level access.
 * Throws 403 if the resolved role is below `required`.
 */
export async function requireSpaceRole(
  c: Context,
  spaceId: number,
  required: ResourceRole
): Promise<void> {
  const user = c.get('user') as AuthUser
  if (!user) {
    c.res = c.json({ error: 'authentication required' }, 401) as Response
    return
  }
  if (user.globalRole === 'super_admin') return

  // 1. Check direct space membership
  const [spaceMembership] = await db
    .select()
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, user.id)))

  if (spaceMembership) {
    if (!hasRole(spaceMembership.role, required))
      throw new HTTPException(403, { message: 'forbidden' })
    return
  }

  // 2. Check group-based space access
  const spaceGroupRows = await db
    .select({ role: spaceGroupAccess.role })
    .from(spaceGroupAccess)
    .innerJoin(groupMembers, eq(spaceGroupAccess.groupId, groupMembers.groupId))
    .where(and(eq(spaceGroupAccess.spaceId, spaceId), eq(groupMembers.userId, user.id)))

  const bestSpaceGroupRole = spaceGroupRows.reduce<ResourceRole | null>((best, row) => {
    if (!best) return row.role
    return ROLE_RANK[row.role] > ROLE_RANK[best] ? row.role : best
  }, null)

  if (bestSpaceGroupRole) {
    if (!hasRole(bestSpaceGroupRole, required))
      throw new HTTPException(403, { message: 'forbidden' })
    return
  }

  // 3. Fall back to app-level access (direct or group)
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId))
  if (!space) throw new HTTPException(404, { message: 'not found' })

  // Direct app membership
  const [appMembership] = await db
    .select()
    .from(appMembers)
    .where(and(eq(appMembers.appId, space.appId), eq(appMembers.userId, user.id)))
  if (appMembership && hasRole(appMembership.role, required)) return

  // Group-based app membership fallback
  const appGroupRows = await db
    .select({ role: appGroupAccess.role })
    .from(appGroupAccess)
    .innerJoin(groupMembers, eq(appGroupAccess.groupId, groupMembers.groupId))
    .where(and(eq(appGroupAccess.appId, space.appId), eq(groupMembers.userId, user.id)))

  const bestAppGroupRole = appGroupRows.reduce<ResourceRole | null>((best, row) => {
    if (!best) return row.role
    return ROLE_RANK[row.role] > ROLE_RANK[best] ? row.role : best
  }, null)

  if (bestAppGroupRole && hasRole(bestAppGroupRole, required)) return

  throw new HTTPException(403, { message: 'forbidden' })
}

/** Throws 403 if the user's global role is not super_admin. */
export function requireSuperAdmin(c: Context): void {
  const user = c.get('user') as AuthUser
  if (!user || user.globalRole !== 'super_admin') {
    throw new HTTPException(403, { message: 'forbidden' })
  }
}

/** Returns the authenticated user from context (assumes requireAuth ran first). */
export function getUser(c: Context): AuthUser {
  return c.get('user') as AuthUser
}
