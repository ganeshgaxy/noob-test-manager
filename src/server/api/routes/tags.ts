import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { tags } from '../../db/schema.js'
import { requireAuth, requireAppRole } from '../middleware/auth.js'

const router = new Hono()

// GET /api/apps/:appId/tags
router.get('/', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'viewer')
  const all = await db.select().from(tags).where(eq(tags.appId, appId))
  return c.json(all)
})

// POST /api/apps/:appId/tags
router.post('/', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'member')
  const body = await c.req.json<{ name: string; color?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)

  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.appId, appId), eq(tags.name, body.name.trim())))
    .limit(1)
  if (existing.length > 0) return c.json(existing[0])

  const [created] = await db
    .insert(tags)
    .values({
      appId,
      name: body.name.trim(),
      color: body.color ?? null,
    })
    .returning()
  return c.json(created, 201)
})

// DELETE /api/apps/:appId/tags/:tagId
router.delete('/:tagId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'admin')
  const tagId = Number(c.req.param('tagId'))
  const [deleted] = await db
    .delete(tags)
    .where(and(eq(tags.id, tagId), eq(tags.appId, appId)))
    .returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

export { router as tagsRouter }
