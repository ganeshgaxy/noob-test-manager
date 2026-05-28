import { Hono } from 'hono'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { folders, tests, spaces } from '../../db/schema.js'
import { cache } from '../../cache/client.js'
import { requireAuth, requireSpaceRole } from '../middleware/auth.js'

const router = new Hono()

/** Look up appId for a space — used to cascade-invalidate the spaces list. */
async function appIdForSpace(spaceId: number): Promise<number | null> {
  const [s] = await db.select({ appId: spaces.appId }).from(spaces).where(eq(spaces.id, spaceId))
  return s?.appId ?? null
}

// GET /api/spaces/:spaceId/folders — active (non-trashed) folders only
router.get('/', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'viewer')
  const key = `folders:space:${spaceId}`
  const cached = await cache.get<unknown[]>(key)
  if (cached) return c.json(cached)

  const all = await db
    .select()
    .from(folders)
    .where(and(eq(folders.spaceId, spaceId), eq(folders.isTrashed, false)))
  if (all.length === 0) {
    await cache.set(key, [])
    return c.json([])
  }

  const folderIds = all.map((f) => f.id)
  const testCounts = await db
    .select({ folderId: tests.folderId, count: sql<number>`count(*)` })
    .from(tests)
    .where(and(inArray(tests.folderId, folderIds), eq(tests.isTrashed, false)))
    .groupBy(tests.folderId)

  const testCountMap = new Map(testCounts.map((r) => [r.folderId, Number(r.count)]))
  const result = all.map((f) => ({ ...f, testCount: testCountMap.get(f.id) ?? 0 }))
  await cache.set(key, result)
  return c.json(result)
})

router.post('/', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'member')
  const body = await c.req.json<{
    name: string
    description?: string
    parentFolderId?: number
    order?: number
  }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)

  const [created] = await db
    .insert(folders)
    .values({
      spaceId,
      name: body.name.trim(),
      description: body.description ?? null,
      parentFolderId: body.parentFolderId ?? null,
      order: body.order ?? 0,
    })
    .returning()

  const appId = await appIdForSpace(spaceId)
  const keys = [`folders:space:${spaceId}`]
  if (appId !== null) keys.push(`spaces:app:${appId}`)
  await cache.del(...keys)
  return c.json(created, 201)
})

router.get('/:folderId', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'viewer')
  const id = Number(c.req.param('folderId'))
  const key = `folder:${id}`
  const cached = await cache.get<typeof folders.$inferSelect>(key)
  if (cached) return c.json(cached)
  const [folder] = await db.select().from(folders).where(eq(folders.id, id))
  if (!folder) return c.json({ error: 'not found' }, 404)
  await cache.set(key, folder)
  return c.json(folder)
})

router.put('/:folderId', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'member')
  const id = Number(c.req.param('folderId'))
  const body = await c.req.json<{
    name?: string
    description?: string
    parentFolderId?: number | null
    order?: number
  }>()

  const [updated] = await db
    .update(folders)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(folders.id, id))
    .returning()

  if (!updated) return c.json({ error: 'not found' }, 404)
  const appId = await appIdForSpace(spaceId)
  const keys = [`folders:space:${spaceId}`, `folder:${id}`]
  if (appId !== null) keys.push(`spaces:app:${appId}`)
  await cache.del(...keys)
  return c.json(updated)
})

// Soft delete — moves folder (and recursively all children) to trash
router.delete('/:folderId', requireAuth, async (c) => {
  const spaceId = Number(c.req.param('spaceId'))
  await requireSpaceRole(c, spaceId, 'admin')
  const id = Number(c.req.param('folderId'))
  const trashedAt = new Date().toISOString()

  // Collect all descendant folder IDs recursively
  const allFolderIds: number[] = [id]
  const queue = [id]
  while (queue.length) {
    const parentId = queue.shift()!
    const children = await db
      .select({ id: folders.id })
      .from(folders)
      .where(eq(folders.parentFolderId, parentId))
    for (const child of children) {
      allFolderIds.push(child.id)
      queue.push(child.id)
    }
  }

  // Soft-delete all folders in the tree
  await db
    .update(folders)
    .set({ isTrashed: true, trashedAt })
    .where(inArray(folders.id, allFolderIds))

  // Soft-delete all tests inside those folders
  await db
    .update(tests)
    .set({ isTrashed: true, trashedAt })
    .where(inArray(tests.folderId, allFolderIds))

  const appId = await appIdForSpace(spaceId)
  const keys = [
    `folders:space:${spaceId}`,
    ...allFolderIds.map((fid) => `folder:${fid}`),
    ...allFolderIds.map((fid) => `tests:folder:${fid}`),
  ]
  if (appId !== null) keys.push(`spaces:app:${appId}`)
  await cache.del(...keys)
  return c.json({ success: true })
})

export default router
