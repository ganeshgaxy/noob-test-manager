import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  appMembers,
  spaceMembers,
  users,
  appGroupAccess,
  spaceGroupAccess,
  groups,
} from '../../db/schema.js'
import { requireAuth, requireAppRole, requireSpaceRole } from '../middleware/auth.js'

const router = new Hono()

type MemberRole = 'admin' | 'member' | 'viewer'

// ─── App members ──────────────────────────────────────────────────────────────

// GET /api/apps/:appId/members
router.get('/apps/:appId/members', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'viewer')

  const members = await db
    .select({
      id: appMembers.id,
      role: appMembers.role,
      createdAt: appMembers.createdAt,
      userId: users.id,
      email: users.email,
      name: users.name,
    })
    .from(appMembers)
    .innerJoin(users, eq(appMembers.userId, users.id))
    .where(eq(appMembers.appId, appId))
  return c.json(members)
})

// POST /api/apps/:appId/members
router.post('/apps/:appId/members', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'admin')

  const body = await c.req.json<{ userId: number; role: MemberRole }>()
  if (!body.userId || !body.role) return c.json({ error: 'userId and role required' }, 400)

  try {
    const [created] = await db
      .insert(appMembers)
      .values({
        appId,
        userId: body.userId,
        role: body.role,
      })
      .returning()
    return c.json(created, 201)
  } catch {
    return c.json({ error: 'user is already a member' }, 409)
  }
})

// PUT /api/apps/:appId/members/:userId
router.put('/apps/:appId/members/:userId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'admin')

  const userId = Number(c.req.param('userId'))
  const body = await c.req.json<{ role: MemberRole }>()

  const [updated] = await db
    .update(appMembers)
    .set({ role: body.role })
    .where(and(eq(appMembers.appId, appId), eq(appMembers.userId, userId)))
    .returning()
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

// DELETE /api/apps/:appId/members/:userId
router.delete('/apps/:appId/members/:userId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'admin')

  const userId = Number(c.req.param('userId'))
  const [deleted] = await db
    .delete(appMembers)
    .where(and(eq(appMembers.appId, appId), eq(appMembers.userId, userId)))
    .returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

// ─── Space members ────────────────────────────────────────────────────────────

// GET /api/spaces/:spaceId/members
router.get('/spaces/:spaceId/members', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'viewer')

  const members = await db
    .select({
      id: spaceMembers.id,
      role: spaceMembers.role,
      createdAt: spaceMembers.createdAt,
      userId: users.id,
      email: users.email,
      name: users.name,
    })
    .from(spaceMembers)
    .innerJoin(users, eq(spaceMembers.userId, users.id))
    .where(eq(spaceMembers.spaceId, spaceId))
  return c.json(members)
})

// POST /api/spaces/:spaceId/members
router.post('/spaces/:spaceId/members', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'admin')

  const body = await c.req.json<{ userId: number; role: MemberRole }>()
  if (!body.userId || !body.role) return c.json({ error: 'userId and role required' }, 400)

  try {
    const [created] = await db
      .insert(spaceMembers)
      .values({
        spaceId,
        userId: body.userId,
        role: body.role,
      })
      .returning()
    return c.json(created, 201)
  } catch {
    return c.json({ error: 'user is already a member' }, 409)
  }
})

// PUT /api/spaces/:spaceId/members/:userId
router.put('/spaces/:spaceId/members/:userId', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'admin')

  const userId = Number(c.req.param('userId'))
  const body = await c.req.json<{ role: MemberRole }>()

  const [updated] = await db
    .update(spaceMembers)
    .set({ role: body.role })
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)))
    .returning()
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

// DELETE /api/spaces/:spaceId/members/:userId
router.delete('/spaces/:spaceId/members/:userId', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'admin')

  const userId = Number(c.req.param('userId'))
  const [deleted] = await db
    .delete(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)))
    .returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

// ─── App Group Access ─────────────────────────────────────────────────────────

// GET /api/apps/:appId/group-access
router.get('/apps/:appId/group-access', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'admin')

  const rows = await db
    .select({
      id: appGroupAccess.id,
      role: appGroupAccess.role,
      createdAt: appGroupAccess.createdAt,
      groupId: groups.id,
      groupName: groups.name,
      groupDescription: groups.description,
    })
    .from(appGroupAccess)
    .innerJoin(groups, eq(appGroupAccess.groupId, groups.id))
    .where(eq(appGroupAccess.appId, appId))
  return c.json(rows)
})

// POST /api/apps/:appId/group-access — grant a group access to an app
router.post('/apps/:appId/group-access', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'admin')

  const body = await c.req.json<{ groupId: number; role: MemberRole }>()
  if (!body.groupId || !body.role) return c.json({ error: 'groupId and role required' }, 400)

  try {
    const [created] = await db
      .insert(appGroupAccess)
      .values({ appId, groupId: body.groupId, role: body.role })
      .returning()
    return c.json(created, 201)
  } catch {
    return c.json({ error: 'group already has access to this app' }, 409)
  }
})

// PUT /api/apps/:appId/group-access/:groupId — update role
router.put('/apps/:appId/group-access/:groupId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'admin')

  const groupId = Number(c.req.param('groupId'))
  const body = await c.req.json<{ role: MemberRole }>()

  const [updated] = await db
    .update(appGroupAccess)
    .set({ role: body.role })
    .where(and(eq(appGroupAccess.appId, appId), eq(appGroupAccess.groupId, groupId)))
    .returning()
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

// DELETE /api/apps/:appId/group-access/:groupId — revoke access
router.delete('/apps/:appId/group-access/:groupId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'admin')

  const groupId = Number(c.req.param('groupId'))
  const [deleted] = await db
    .delete(appGroupAccess)
    .where(and(eq(appGroupAccess.appId, appId), eq(appGroupAccess.groupId, groupId)))
    .returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

// ─── Space Group Access ───────────────────────────────────────────────────────

// GET /api/spaces/:spaceId/group-access
router.get('/spaces/:spaceId/group-access', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'admin')

  const rows = await db
    .select({
      id: spaceGroupAccess.id,
      role: spaceGroupAccess.role,
      createdAt: spaceGroupAccess.createdAt,
      groupId: groups.id,
      groupName: groups.name,
      groupDescription: groups.description,
    })
    .from(spaceGroupAccess)
    .innerJoin(groups, eq(spaceGroupAccess.groupId, groups.id))
    .where(eq(spaceGroupAccess.spaceId, spaceId))
  return c.json(rows)
})

// POST /api/spaces/:spaceId/group-access
router.post('/spaces/:spaceId/group-access', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'admin')

  const body = await c.req.json<{ groupId: number; role: MemberRole }>()
  if (!body.groupId || !body.role) return c.json({ error: 'groupId and role required' }, 400)

  try {
    const [created] = await db
      .insert(spaceGroupAccess)
      .values({ spaceId, groupId: body.groupId, role: body.role })
      .returning()
    return c.json(created, 201)
  } catch {
    return c.json({ error: 'group already has access to this space' }, 409)
  }
})

// PUT /api/spaces/:spaceId/group-access/:groupId
router.put('/spaces/:spaceId/group-access/:groupId', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'admin')

  const groupId = Number(c.req.param('groupId'))
  const body = await c.req.json<{ role: MemberRole }>()

  const [updated] = await db
    .update(spaceGroupAccess)
    .set({ role: body.role })
    .where(and(eq(spaceGroupAccess.spaceId, spaceId), eq(spaceGroupAccess.groupId, groupId)))
    .returning()
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

// DELETE /api/spaces/:spaceId/group-access/:groupId
router.delete('/spaces/:spaceId/group-access/:groupId', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'admin')

  const groupId = Number(c.req.param('groupId'))
  const [deleted] = await db
    .delete(spaceGroupAccess)
    .where(and(eq(spaceGroupAccess.spaceId, spaceId), eq(spaceGroupAccess.groupId, groupId)))
    .returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

export { router as membersRouter }
