import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { spaceTags, globalTags } from '../../db/schema.js'
import { requireAuth, requireSpaceRole } from '../middleware/auth.js'

const router = new Hono()

// GET /api/spaces/:spaceId/space-tags — list all space tags
router.get('/', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'viewer')
  const all = await db
    .select()
    .from(spaceTags)
    .where(eq(spaceTags.spaceId, spaceId))
    .orderBy(spaceTags.name)
  return c.json(all)
})

// POST /api/spaces/:spaceId/space-tags — create a space tag
router.post('/', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'member')
  const body = await c.req.json<{ name: string; color?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)

  const name = body.name.trim()

  // Block if same name exists as a global tag
  const globalConflict = await db
    .select()
    .from(globalTags)
    .where(eq(globalTags.name, name))
    .limit(1)
  if (globalConflict.length > 0)
    return c.json(
      { error: `"${name}" is a global tag and cannot be duplicated at space level` },
      409
    )

  // Return existing if already in this space
  const existing = await db
    .select()
    .from(spaceTags)
    .where(and(eq(spaceTags.spaceId, spaceId), eq(spaceTags.name, name)))
    .limit(1)
  if (existing.length > 0) return c.json(existing[0])

  const [created] = await db
    .insert(spaceTags)
    .values({ spaceId, name, color: body.color ?? null })
    .returning()
  return c.json(created, 201)
})

// PATCH /api/spaces/:spaceId/space-tags/:tagId — update name/color
router.patch('/:tagId', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'admin')
  const tagId = Number(c.req.param('tagId'))
  const body = await c.req.json<{ name?: string; color?: string }>()

  const updates: Partial<{ name: string; color: string | null }> = {}
  if (body.name !== undefined) {
    const newName = body.name.trim()
    // Check no collision with global tags
    const globalConflict = await db
      .select()
      .from(globalTags)
      .where(eq(globalTags.name, newName))
      .limit(1)
    if (globalConflict.length > 0)
      return c.json(
        { error: `"${newName}" is a global tag and cannot be duplicated at space level` },
        409
      )
    updates.name = newName
  }
  if (body.color !== undefined) updates.color = body.color ?? null

  if (Object.keys(updates).length === 0) return c.json({ error: 'nothing to update' }, 400)

  const [updated] = await db
    .update(spaceTags)
    .set(updates)
    .where(and(eq(spaceTags.id, tagId), eq(spaceTags.spaceId, spaceId)))
    .returning()
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

// DELETE /api/spaces/:spaceId/space-tags/:tagId — delete
router.delete('/:tagId', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'admin')
  const tagId = Number(c.req.param('tagId'))
  const [deleted] = await db
    .delete(spaceTags)
    .where(and(eq(spaceTags.id, tagId), eq(spaceTags.spaceId, spaceId)))
    .returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

export { router as spaceTagsRouter }
