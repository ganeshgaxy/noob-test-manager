import { Hono } from 'hono'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  tests,
  testSteps,
  bddScenarios,
  bddSteps,
  folders,
  customFieldValues,
} from '../../db/schema.js'

const router = new Hono()

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cloneTest(testId: number, targetFolderId: number, actor?: string): Promise<number> {
  const [orig] = await db.select().from(tests).where(eq(tests.id, testId))
  if (!orig) throw new Error(`Test ${testId} not found`)

  const [copy] = await db
    .insert(tests)
    .values({
      folderId: targetFolderId,
      type: orig.type,
      title: `${orig.title} (copy)`,
      description: orig.description,
      preconditions: orig.preconditions,
      notes: orig.notes,
      priority: orig.priority,
      status: orig.status,
      tags: orig.tags,
      assigneeId: orig.assigneeId,
      createdBy: actor ?? orig.createdBy,
      updatedBy: actor ?? orig.updatedBy,
    })
    .returning()

  if (orig.type === 'traditional') {
    const steps = await db.select().from(testSteps).where(eq(testSteps.testId, testId))
    if (steps.length) {
      await db.insert(testSteps).values(
        steps.map((s) => ({
          testId: copy.id,
          action: s.action,
          expectedResult: s.expectedResult,
          order: s.order,
        }))
      )
    }
  } else {
    const scenarios = await db.select().from(bddScenarios).where(eq(bddScenarios.testId, testId))
    for (const sc of scenarios) {
      const [newSc] = await db
        .insert(bddScenarios)
        .values({
          testId: copy.id,
          feature: sc.feature,
          scenario: sc.scenario,
          order: sc.order,
        })
        .returning()
      const bSteps = await db.select().from(bddSteps).where(eq(bddSteps.scenarioId, sc.id))
      if (bSteps.length) {
        await db.insert(bddSteps).values(
          bSteps.map((s) => ({
            scenarioId: newSc.id,
            type: s.type,
            text: s.text,
            order: s.order,
          }))
        )
      }
    }
  }

  const cfv = await db.select().from(customFieldValues).where(eq(customFieldValues.testId, testId))
  if (cfv.length) {
    await db
      .insert(customFieldValues)
      .values(cfv.map((v) => ({ testId: copy.id, fieldId: v.fieldId, value: v.value })))
  }

  return copy.id
}

async function cloneFolder(
  folderId: number,
  targetParentId: number | null,
  spaceId: number,
  actor?: string
): Promise<number> {
  const [orig] = await db.select().from(folders).where(eq(folders.id, folderId))
  if (!orig) throw new Error(`Folder ${folderId} not found`)

  const [copy] = await db
    .insert(folders)
    .values({
      spaceId,
      name: `${orig.name} (copy)`,
      description: orig.description,
      parentFolderId: targetParentId,
      order: orig.order,
    })
    .returning()

  const folderTests = await db.select().from(tests).where(eq(tests.folderId, folderId))
  for (const t of folderTests) await cloneTest(t.id, copy.id, actor)

  const children = await db.select().from(folders).where(eq(folders.parentFolderId, folderId))
  for (const child of children) await cloneFolder(child.id, copy.id, spaceId, actor)

  return copy.id
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post('/tests/duplicate', async (c) => {
  const body = await c.req.json<{ testIds: number[]; targetFolderId: number; actor?: string }>()
  if (!body.testIds?.length) return c.json({ error: 'testIds is required' }, 400)
  if (!body.targetFolderId) return c.json({ error: 'targetFolderId is required' }, 400)
  const duplicated = await Promise.all(
    body.testIds.map((id) => cloneTest(id, body.targetFolderId, body.actor))
  )
  return c.json({ duplicated }, 201)
})

router.patch('/tests/move', async (c) => {
  const body = await c.req.json<{ testIds: number[]; targetFolderId: number }>()
  if (!body.testIds?.length) return c.json({ error: 'testIds is required' }, 400)
  if (!body.targetFolderId) return c.json({ error: 'targetFolderId is required' }, 400)
  await db
    .update(tests)
    .set({ folderId: body.targetFolderId, updatedAt: new Date().toISOString() })
    .where(inArray(tests.id, body.testIds))
  return c.json({ moved: body.testIds })
})

router.post('/folders/duplicate', async (c) => {
  const body = await c.req.json<{
    folderIds: number[]
    targetParentFolderId?: number | null
    spaceId: number
    actor?: string
  }>()
  if (!body.folderIds?.length) return c.json({ error: 'folderIds is required' }, 400)
  if (!body.spaceId) return c.json({ error: 'spaceId is required' }, 400)
  if (body.targetParentFolderId != null) {
    const allFolders = await db.select().from(folders)
    const sourceIds = new Set(body.folderIds)
    // Walk up from target to root — if we hit a source folder, the target is
    // the source itself or one of its descendants → reject.
    let cur: number | null = body.targetParentFolderId
    while (cur != null) {
      if (sourceIds.has(cur))
        return c.json({ error: 'Cannot paste a folder into itself or its own subfolder' }, 400)
      cur = allFolders.find((f) => f.id === cur)?.parentFolderId ?? null
    }
  }
  const duplicated = await Promise.all(
    body.folderIds.map((id) =>
      cloneFolder(id, body.targetParentFolderId ?? null, body.spaceId, body.actor)
    )
  )
  return c.json({ duplicated }, 201)
})

router.patch('/folders/move', async (c) => {
  const body = await c.req.json<{ folderIds: number[]; targetParentFolderId: number | null }>()
  if (!body.folderIds?.length) return c.json({ error: 'folderIds is required' }, 400)
  if (body.targetParentFolderId != null) {
    const allFolders = await db.select().from(folders)
    const moving = new Set(body.folderIds)
    let cur: number | null = body.targetParentFolderId
    while (cur != null) {
      if (moving.has(cur))
        return c.json({ error: 'Cannot move a folder into its own descendant' }, 400)
      cur = allFolders.find((f) => f.id === cur)?.parentFolderId ?? null
    }
  }
  for (const folderId of body.folderIds) {
    await db
      .update(folders)
      .set({ parentFolderId: body.targetParentFolderId, updatedAt: new Date().toISOString() })
      .where(eq(folders.id, folderId))
  }
  return c.json({ moved: body.folderIds })
})

// ─── Bulk update metadata ─────────────────────────────────────────────────────

router.patch('/tests/update', async (c) => {
  const body = await c.req.json<{
    testIds: number[]
    updates: {
      priority?: string
      status?: string
      assigneeId?: string
      tags?: string[]
      tagsMode?: 'replace' | 'append'
    }
  }>()
  if (!body.testIds?.length) return c.json({ error: 'testIds is required' }, 400)
  if (!body.updates || Object.keys(body.updates).length === 0)
    return c.json({ error: 'updates is required' }, 400)

  const { priority, status, assigneeId, tags, tagsMode = 'replace' } = body.updates
  const now = new Date().toISOString()

  if (tagsMode === 'append' && tags?.length) {
    // For append mode, fetch each test's current tags and merge
    const rows = await db
      .select({ id: tests.id, tags: tests.tags })
      .from(tests)
      .where(inArray(tests.id, body.testIds))

    for (const row of rows) {
      let existing: string[]
      try {
        existing = row.tags ? (JSON.parse(row.tags) as string[]) : []
      } catch {
        existing = []
      }
      const merged = Array.from(new Set([...existing, ...tags]))
      const patch: Record<string, unknown> = { tags: JSON.stringify(merged), updatedAt: now }
      if (priority !== undefined) patch.priority = priority
      if (status !== undefined) patch.status = status
      if (assigneeId !== undefined) patch.assigneeId = assigneeId || null
      await db
        .update(tests)
        .set(patch as Parameters<typeof db.update>[0] extends infer U ? U : never)
        .where(eq(tests.id, row.id))
    }
  } else {
    // Replace mode — build a single patch object with only the fields supplied
    const patch: Record<string, unknown> = { updatedAt: now }
    if (priority !== undefined) patch.priority = priority
    if (status !== undefined) patch.status = status
    if (assigneeId !== undefined) patch.assigneeId = assigneeId || null
    if (tags !== undefined) patch.tags = JSON.stringify(tags)
    await db
      .update(tests)
      .set(patch as Parameters<typeof db.update>[0] extends infer U ? U : never)
      .where(inArray(tests.id, body.testIds))
  }

  return c.json({ updated: body.testIds.length })
})

// ─── Bulk trash (soft delete) ─────────────────────────────────────────────────

router.post('/tests/delete', async (c) => {
  const body = await c.req.json<{ testIds: number[] }>()
  if (!body.testIds?.length) return c.json({ error: 'testIds is required' }, 400)
  const trashedAt = new Date().toISOString()
  await db.update(tests).set({ isTrashed: true, trashedAt }).where(inArray(tests.id, body.testIds))
  return c.json({ trashed: body.testIds })
})

export default router
