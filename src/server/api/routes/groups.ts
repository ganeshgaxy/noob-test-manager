import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { groups, groupMembers, users } from '../../db/schema.js'
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js'

const router = new Hono()

// ─── Groups CRUD (super_admin only for write operations) ──────────────────────

// GET /api/groups — all groups (any authenticated user can read for member-picker)
router.get('/', requireAuth, async (c) => {
  const all = await db.select().from(groups)
  return c.json(all)
})

// POST /api/groups — create group
router.post('/', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const body = await c.req.json<{ name: string; description?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)

  try {
    const [created] = await db
      .insert(groups)
      .values({ name: body.name.trim(), description: body.description ?? null })
      .returning()
    return c.json(created, 201)
  } catch {
    return c.json({ error: 'group name already exists' }, 409)
  }
})

// PUT /api/groups/:id — update group
router.put('/:id', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{ name?: string; description?: string }>()

  try {
    const [updated] = await db
      .update(groups)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(groups.id, id))
      .returning()
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  } catch {
    return c.json({ error: 'group name already exists' }, 409)
  }
})

// DELETE /api/groups/:id — delete group (cascades to groupMembers + access tables)
router.delete('/:id', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const id = Number(c.req.param('id'))
  const [deleted] = await db.delete(groups).where(eq(groups.id, id)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

// ─── Group Members ────────────────────────────────────────────────────────────

// GET /api/groups/:id/members — list members of a group
router.get('/:id/members', requireAuth, async (c) => {
  const groupId = Number(c.req.param('id'))
  const members = await db
    .select({
      id: groupMembers.id,
      groupId: groupMembers.groupId,
      createdAt: groupMembers.createdAt,
      userId: users.id,
      email: users.email,
      name: users.name,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
  return c.json(members)
})

// POST /api/groups/:id/members — add user to group
router.post('/:id/members', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const groupId = Number(c.req.param('id'))
  const body = await c.req.json<{ userId: number }>()
  if (!body.userId) return c.json({ error: 'userId is required' }, 400)

  try {
    const [created] = await db
      .insert(groupMembers)
      .values({ groupId, userId: body.userId })
      .returning()
    return c.json(created, 201)
  } catch {
    return c.json({ error: 'user is already a member of this group' }, 409)
  }
})

// DELETE /api/groups/:id/members/:userId — remove user from group
router.delete('/:id/members/:userId', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const groupId = Number(c.req.param('id'))
  const userId = Number(c.req.param('userId'))

  const [deleted] = await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

export { router as groupsRouter }
