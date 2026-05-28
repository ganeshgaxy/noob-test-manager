import { Hono } from 'hono'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { folders, tests } from '../../db/schema.js'

const router = new Hono()

// ─── List trashed items for a space ─────────────────────────────────────────
// GET /api/spaces/:spaceId/trash

router.get('/', async (c) => {
  const spaceId = Number(c.req.param('spaceId'))

  // All trashed folders in this space (top-level only for display)
  const trashedFolders = await db
    .select()
    .from(folders)
    .where(and(eq(folders.spaceId, spaceId), eq(folders.isTrashed, true)))

  // All trashed tests whose folder belongs to this space
  const activeFolders = await db
    .select({ id: folders.id })
    .from(folders)
    .where(eq(folders.spaceId, spaceId))

  const allFolderIds = activeFolders.map((f) => f.id)
  const trashedTests =
    allFolderIds.length > 0
      ? await db
          .select()
          .from(tests)
          .where(and(inArray(tests.folderId, allFolderIds), eq(tests.isTrashed, true)))
      : []

  return c.json({ folders: trashedFolders, tests: trashedTests })
})

// ─── Restore tests ───────────────────────────────────────────────────────────
// POST /api/spaces/:spaceId/trash/tests/restore   body: { testIds }

router.post('/tests/restore', async (c) => {
  const body = await c.req.json<{ testIds: number[] }>()
  if (!body.testIds?.length) return c.json({ error: 'testIds is required' }, 400)
  await db
    .update(tests)
    .set({ isTrashed: false, trashedAt: null })
    .where(inArray(tests.id, body.testIds))
  return c.json({ restored: body.testIds })
})

// ─── Restore folders ─────────────────────────────────────────────────────────
// POST /api/spaces/:spaceId/trash/folders/restore   body: { folderIds }

router.post('/folders/restore', async (c) => {
  const body = await c.req.json<{ folderIds: number[] }>()
  if (!body.folderIds?.length) return c.json({ error: 'folderIds is required' }, 400)
  const trashedAt = null

  // Restore the folders themselves
  await db
    .update(folders)
    .set({ isTrashed: false, trashedAt })
    .where(inArray(folders.id, body.folderIds))

  // Also restore all tests inside those folders
  await db
    .update(tests)
    .set({ isTrashed: false, trashedAt })
    .where(inArray(tests.folderId, body.folderIds))

  return c.json({ restored: body.folderIds })
})

// ─── Permanently delete a trashed test ───────────────────────────────────────
// DELETE /api/spaces/:spaceId/trash/tests/:testId

router.delete('/tests/:testId', async (c) => {
  const id = Number(c.req.param('testId'))
  const [deleted] = await db.delete(tests).where(eq(tests.id, id)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

// ─── Permanently delete a trashed folder ─────────────────────────────────────
// DELETE /api/spaces/:spaceId/trash/folders/:folderId

router.delete('/folders/:folderId', async (c) => {
  const id = Number(c.req.param('folderId'))
  // Hard delete — cascade removes child folders and tests via FK
  const [deleted] = await db.delete(folders).where(eq(folders.id, id)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

export default router
