import { Hono } from 'hono'
import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { spaces, folders, tests, runResults } from '../../db/schema.js'
import { cache } from '../../cache/client.js'
import { requireAuth, requireAppRole, requireSpaceRole } from '../middleware/auth.js'

const router = new Hono()

// GET /api/apps/:appId/spaces
router.get('/', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'viewer')
  const key = `spaces:app:${appId}`
  const cached = await cache.get<unknown[]>(key)
  if (cached) return c.json(cached)

  const all = await db.select().from(spaces).where(eq(spaces.appId, appId))
  if (all.length === 0) {
    await cache.set(key, [])
    return c.json([])
  }

  const spaceIds = all.map((s) => s.id)

  const [folderCounts, testCounts] = await Promise.all([
    db
      .select({ spaceId: folders.spaceId, count: sql<number>`count(*)` })
      .from(folders)
      .where(inArray(folders.spaceId, spaceIds))
      .groupBy(folders.spaceId),
    db
      .select({ spaceId: folders.spaceId, count: sql<number>`count(${tests.id})` })
      .from(tests)
      .innerJoin(folders, eq(tests.folderId, folders.id))
      .where(inArray(folders.spaceId, spaceIds))
      .groupBy(folders.spaceId),
  ])

  const folderCountMap = new Map(folderCounts.map((r) => [r.spaceId, Number(r.count)]))
  const testCountMap = new Map(testCounts.map((r) => [r.spaceId, Number(r.count)]))

  const result = all.map((s) => ({
    ...s,
    folderCount: folderCountMap.get(s.id) ?? 0,
    testCount: testCountMap.get(s.id) ?? 0,
  }))
  await cache.set(key, result)
  return c.json(result)
})

router.post('/', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'admin')
  const body = await c.req.json<{ name: string; description?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)

  const [created] = await db
    .insert(spaces)
    .values({
      appId,
      name: body.name.trim(),
      description: body.description ?? null,
    })
    .returning()

  await cache.del(`spaces:app:${appId}`)
  return c.json(created, 201)
})

router.get('/:spaceId', requireAuth, async (c) => {
  const id = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, id, 'viewer')
  const key = `space:${id}`
  const cached = await cache.get<typeof spaces.$inferSelect>(key)
  if (cached) return c.json(cached)
  const [space] = await db.select().from(spaces).where(eq(spaces.id, id))
  if (!space) return c.json({ error: 'not found' }, 404)
  await cache.set(key, space)
  return c.json(space)
})

router.put('/:spaceId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  const id = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, id, 'admin')
  const body = await c.req.json<{ name?: string; description?: string }>()

  const [updated] = await db
    .update(spaces)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(spaces.id, id))
    .returning()

  if (!updated) return c.json({ error: 'not found' }, 404)
  await cache.del(`spaces:app:${appId}`, `space:${id}`)
  return c.json(updated)
})

router.delete('/:spaceId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  const id = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, id, 'admin')

  // run_results.test_id has no ON DELETE CASCADE, so we must manually remove
  // run_results for every test that lives inside this space before deleting it.
  const folderRows = await db
    .select({ id: folders.id })
    .from(folders)
    .where(eq(folders.spaceId, id))
  const folderIds = folderRows.map((f) => f.id)
  if (folderIds.length > 0) {
    const testRows = await db
      .select({ id: tests.id })
      .from(tests)
      .where(inArray(tests.folderId, folderIds))
    const testIds = testRows.map((t) => t.id)
    if (testIds.length > 0) {
      await db.delete(runResults).where(inArray(runResults.testId, testIds))
    }
  }

  const [deleted] = await db.delete(spaces).where(eq(spaces.id, id)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  await cache.del(`spaces:app:${appId}`, `space:${id}`)
  return c.json({ success: true })
})

export default router
