import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { globalTags } from '../../db/schema.js'
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js'

const router = new Hono()

// GET /api/global-tags — list all global tags (any authenticated user)
router.get('/', requireAuth, async (c) => {
  const all = await db.select().from(globalTags).orderBy(globalTags.name)
  return c.json(all)
})

// POST /api/global-tags — create a global tag (super_admin only)
router.post('/', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const body = await c.req.json<{ name: string; color?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)

  const name = body.name.trim()

  const existing = await db.select().from(globalTags).where(eq(globalTags.name, name)).limit(1)
  if (existing.length > 0)
    return c.json({ error: 'A global tag with this name already exists' }, 409)

  const [created] = await db
    .insert(globalTags)
    .values({ name, color: body.color ?? null })
    .returning()
  return c.json(created, 201)
})

// PATCH /api/global-tags/:tagId — update name/color (super_admin only)
router.patch('/:tagId', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const tagId = Number(c.req.param('tagId'))
  const body = await c.req.json<{ name?: string; color?: string }>()

  const updates: Partial<{ name: string; color: string | null }> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.color !== undefined) updates.color = body.color ?? null

  if (Object.keys(updates).length === 0) return c.json({ error: 'nothing to update' }, 400)

  const [updated] = await db
    .update(globalTags)
    .set(updates)
    .where(eq(globalTags.id, tagId))
    .returning()
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

// DELETE /api/global-tags/:tagId — delete (super_admin only)
router.delete('/:tagId', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const tagId = Number(c.req.param('tagId'))
  const [deleted] = await db.delete(globalTags).where(eq(globalTags.id, tagId)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

export { router as globalTagsRouter }
