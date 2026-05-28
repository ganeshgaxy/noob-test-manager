import { Hono } from 'hono'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  tests,
  testSteps,
  bddScenarios,
  bddSteps,
  testHistory,
  folders,
  spaces,
  tags,
  testTags,
} from '../../db/schema.js'
import type { Test } from '../../db/schema.js'
import { cache } from '../../cache/client.js'
import { requireAuth, requireSpaceRole } from '../middleware/auth.js'

const router = new Hono()

/** Look up spaceId for a folder — used to check space-level permissions. */
async function spaceIdForFolder(folderId: number): Promise<number | null> {
  const [f] = await db
    .select({ spaceId: folders.spaceId })
    .from(folders)
    .where(eq(folders.id, folderId))
  return f?.spaceId ?? null
}

/** Look up appId for a folder via the space. */
async function appIdForFolder(folderId: number): Promise<number | null> {
  const [f] = await db
    .select({ spaceId: folders.spaceId })
    .from(folders)
    .where(eq(folders.id, folderId))
  if (!f) return null
  const [s] = await db.select({ appId: spaces.appId }).from(spaces).where(eq(spaces.id, f.spaceId))
  return s?.appId ?? null
}

/** Find or create a tag by name for an app, returning its id.
 *  Uses insert-first to avoid race conditions on Postgres/Turso. */
async function upsertTag(appId: number, name: string): Promise<number> {
  // Try to insert; if the unique constraint fires, the row already exists
  const inserted = await db
    .insert(tags)
    .values({ appId, name })
    .onConflictDoNothing()
    .returning({ id: tags.id })
  if (inserted.length > 0) return inserted[0].id

  // Row already existed — fetch it
  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.appId, appId), eq(tags.name, name)))
    .limit(1)
  return existing.id
}

// GET /api/folders/:folderId/tests — only active (non-trashed) tests
router.get('/', requireAuth, async (c) => {
  const folderId = Number(c.req.param('folderId'))
  const sid = await spaceIdForFolder(folderId)
  if (sid) await requireSpaceRole(c, sid, 'viewer')
  const key = `tests:folder:${folderId}`
  const cached = await cache.get<unknown[]>(key)
  if (cached) return c.json(cached)
  const all = await db
    .select()
    .from(tests)
    .where(and(eq(tests.folderId, folderId), eq(tests.isTrashed, false)))
  await cache.set(key, all)
  return c.json(all)
})

router.post('/', requireAuth, async (c) => {
  const folderId = Number(c.req.param('folderId'))
  const sid = await spaceIdForFolder(folderId)
  if (sid) await requireSpaceRole(c, sid, 'member')
  const body = await c.req.json<{
    type?: 'traditional' | 'bdd'
    category?: string
    title: string
    description?: string
    preconditions?: string
    notes?: string
    priority?: string
    status?: string
    tags?: string[]
    tagNames?: string[]
    assigneeId?: string
    estimatedTime?: number
    automationStatus?: string
    jiraIssueKey?: string
    createdBy: string
  }>()

  if (!body.title?.trim()) return c.json({ error: 'title is required' }, 400)
  if (!body.createdBy?.trim()) return c.json({ error: 'createdBy is required' }, 400)

  const [created] = await db
    .insert(tests)
    .values({
      folderId,
      type: body.type ?? 'traditional',
      title: body.title.trim(),
      description: body.description ?? null,
      preconditions: body.preconditions ?? null,
      notes: body.notes ?? null,
      priority: (body.priority as (typeof tests.$inferInsert)['priority']) ?? 'Medium',
      status: (body.status as (typeof tests.$inferInsert)['status']) ?? 'Draft',
      tags: body.tags ? JSON.stringify(body.tags) : null,
      assigneeId: body.assigneeId ?? null,
      estimatedTime: body.estimatedTime ?? null,
      automationStatus:
        (body.automationStatus as (typeof tests.$inferInsert)['automationStatus']) ?? null,
      category: (body.category as (typeof tests.$inferInsert)['category']) ?? null,
      jiraIssueKey: body.jiraIssueKey ?? null,
      createdBy: body.createdBy,
      updatedBy: body.createdBy,
    })
    .returning()

  // Generate internalId based on the auto-incremented pk
  const internalId = `TC${created.id + 100000}`
  await db.update(tests).set({ internalId }).where(eq(tests.id, created.id))

  // Handle tags: find/create global tags and associate with this test
  const tagNames = body.tagNames ?? body.tags ?? []
  if (tagNames.length > 0) {
    const appId = await appIdForFolder(folderId)
    if (appId) {
      const tagIds = await Promise.all(tagNames.map((n) => upsertTag(appId, String(n))))
      await db
        .insert(testTags)
        .values(tagIds.map((tagId) => ({ testId: created.id, tagId })))
        .onConflictDoNothing()
    }
  }

  await cache.del(`tests:folder:${folderId}`, `folders:space:${folderId}`)
  return c.json({ ...created, internalId }, 201)
})

// GET /api/folders/:folderId/tests/:testId — full test with steps/scenarios
router.get('/:testId', requireAuth, async (c) => {
  const folderId = Number(c.req.param('folderId'))
  const sid = await spaceIdForFolder(folderId)
  if (sid) await requireSpaceRole(c, sid, 'viewer')
  const id = Number(c.req.param('testId'))
  const key = `test:${id}`
  const cached = await cache.get<unknown>(key)
  if (cached) return c.json(cached)

  const [test] = await db.select().from(tests).where(eq(tests.id, id))
  if (!test) return c.json({ error: 'not found' }, 404)

  let result: unknown
  if (test.type === 'traditional') {
    const steps = await db.select().from(testSteps).where(eq(testSteps.testId, id))
    result = { ...test, steps }
  } else {
    const scenarios = await db.select().from(bddScenarios).where(eq(bddScenarios.testId, id))
    const scenarioIds = scenarios.map((s) => s.id)
    const steps = scenarioIds.length
      ? await db.select().from(bddSteps).where(inArray(bddSteps.scenarioId, scenarioIds))
      : []
    result = {
      ...test,
      scenarios: scenarios.map((s) => ({
        ...s,
        steps: steps.filter((st) => st.scenarioId === s.id),
      })),
    }
  }
  await cache.set(key, result, 15)
  return c.json(result)
})

router.put('/:testId', requireAuth, async (c) => {
  const folderId = Number(c.req.param('folderId'))
  const sid = await spaceIdForFolder(folderId)
  if (sid) await requireSpaceRole(c, sid, 'member')
  const id = Number(c.req.param('testId'))
  const body = await c.req.json<Partial<Test> & { updatedBy: string }>()

  if (!body.updatedBy?.trim()) return c.json({ error: 'updatedBy is required' }, 400)

  const [existing] = await db.select().from(tests).where(eq(tests.id, id))
  if (!existing) return c.json({ error: 'not found' }, 404)

  // Record history for changed fields
  const trackedFields = [
    'title',
    'description',
    'preconditions',
    'notes',
    'priority',
    'status',
    'tags',
    'assigneeId',
  ] as const
  const historyRows = trackedFields
    .filter((f) => body[f] !== undefined && String(body[f]) !== String(existing[f]))
    .map((f) => ({
      testId: id,
      field: f,
      oldValue: existing[f] != null ? String(existing[f]) : null,
      newValue: body[f] != null ? String(body[f]) : null,
      changedBy: body.updatedBy,
    }))

  if (historyRows.length) {
    await db.insert(testHistory).values(historyRows)
  }

  const [updated] = await db
    .update(tests)
    .set({
      ...body,
      tags: body.tags ? JSON.stringify(body.tags) : undefined,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tests.id, id))
    .returning()

  await cache.del(`tests:folder:${existing.folderId}`, `test:${id}`)
  return c.json(updated)
})

// Soft delete — moves test to trash
router.delete('/:testId', requireAuth, async (c) => {
  const folderId = Number(c.req.param('folderId'))
  const sid = await spaceIdForFolder(folderId)
  if (sid) await requireSpaceRole(c, sid, 'member')
  const id = Number(c.req.param('testId'))
  const [updated] = await db
    .update(tests)
    .set({ isTrashed: true, trashedAt: new Date().toISOString() })
    .where(eq(tests.id, id))
    .returning()
  if (!updated) return c.json({ error: 'not found' }, 404)
  await cache.del(`tests:folder:${folderId}`, `test:${id}`)
  return c.json({ success: true })
})

// ─── History ──────────────────────────────────────────────────────────────────

router.get('/:testId/history', requireAuth, async (c) => {
  const id = Number(c.req.param('testId'))
  const history = await db.select().from(testHistory).where(eq(testHistory.testId, id))
  return c.json(history)
})

// ─── Traditional steps ────────────────────────────────────────────────────────

router.get('/:testId/steps', requireAuth, async (c) => {
  const id = Number(c.req.param('testId'))
  const steps = await db.select().from(testSteps).where(eq(testSteps.testId, id))
  return c.json(steps)
})

router.post('/:testId/steps', requireAuth, async (c) => {
  const folderId = Number(c.req.param('folderId'))
  const stepSid = await spaceIdForFolder(folderId)
  if (stepSid) await requireSpaceRole(c, stepSid, 'member')
  const testId = Number(c.req.param('testId'))
  const body = await c.req.json<{ action: string; expectedResult?: string; order?: number }>()
  if (!body.action?.trim()) return c.json({ error: 'action is required' }, 400)

  const [created] = await db
    .insert(testSteps)
    .values({
      testId,
      action: body.action.trim(),
      expectedResult: body.expectedResult ?? null,
      order: body.order ?? 0,
    })
    .returning()

  await cache.del(`test:${testId}`)
  return c.json(created, 201)
})

router.post('/:testId/steps/bulk', requireAuth, async (c) => {
  const folderId = Number(c.req.param('folderId'))
  const stepSid = await spaceIdForFolder(folderId)
  if (stepSid) await requireSpaceRole(c, stepSid, 'member')
  const testId = Number(c.req.param('testId'))
  const body = await c.req.json<{
    steps: Array<{ action: string; expectedResult?: string; order?: number }>
  }>()

  if (!Array.isArray(body.steps) || body.steps.length === 0) {
    return c.json({ error: 'steps array is required' }, 400)
  }

  const created = await db
    .insert(testSteps)
    .values(
      body.steps.map((s) => ({
        testId,
        action: s.action.trim(),
        expectedResult: s.expectedResult ?? null,
        order: s.order ?? 0,
      }))
    )
    .returning()

  await cache.del(`test:${testId}`)
  return c.json(created, 201)
})

router.put('/:testId/steps/:stepId', requireAuth, async (c) => {
  const testId = Number(c.req.param('testId'))
  const stepId = Number(c.req.param('stepId'))
  const body = await c.req.json<{ action?: string; expectedResult?: string; order?: number }>()

  const [updated] = await db
    .update(testSteps)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(testSteps.id, stepId))
    .returning()

  if (!updated) return c.json({ error: 'not found' }, 404)
  await cache.del(`test:${testId}`)
  return c.json(updated)
})

router.delete('/:testId/steps/:stepId', requireAuth, async (c) => {
  const testId = Number(c.req.param('testId'))
  const stepId = Number(c.req.param('stepId'))
  const [deleted] = await db.delete(testSteps).where(eq(testSteps.id, stepId)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  await cache.del(`test:${testId}`)
  return c.json({ success: true })
})

// ─── BDD scenarios ────────────────────────────────────────────────────────────

router.get('/:testId/scenarios', requireAuth, async (c) => {
  const testId = Number(c.req.param('testId'))
  const scenarios = await db.select().from(bddScenarios).where(eq(bddScenarios.testId, testId))
  const ids = scenarios.map((s) => s.id)
  const steps = ids.length
    ? await db.select().from(bddSteps).where(inArray(bddSteps.scenarioId, ids))
    : []
  return c.json(
    scenarios.map((s) => ({ ...s, steps: steps.filter((st) => st.scenarioId === s.id) }))
  )
})

router.post('/:testId/scenarios', requireAuth, async (c) => {
  const testId = Number(c.req.param('testId'))
  const body = await c.req.json<{
    feature?: string
    scenario: string
    order?: number
    steps?: Array<{ type: 'given' | 'when' | 'then' | 'and' | 'but'; text: string; order?: number }>
  }>()
  if (!body.scenario?.trim()) return c.json({ error: 'scenario is required' }, 400)

  const [scenario] = await db
    .insert(bddScenarios)
    .values({
      testId,
      feature: body.feature ?? null,
      scenario: body.scenario.trim(),
      order: body.order ?? 0,
    })
    .returning()

  if (body.steps?.length) {
    await db.insert(bddSteps).values(
      body.steps.map((s, i) => ({
        scenarioId: scenario.id,
        type: s.type,
        text: s.text,
        order: s.order ?? i,
      }))
    )
  }

  const steps = await db.select().from(bddSteps).where(eq(bddSteps.scenarioId, scenario.id))
  await cache.del(`test:${testId}`)
  return c.json({ ...scenario, steps }, 201)
})

router.put('/:testId/scenarios/:scenarioId', requireAuth, async (c) => {
  const testId = Number(c.req.param('testId'))
  const scenarioId = Number(c.req.param('scenarioId'))
  const body = await c.req.json<{ feature?: string; scenario?: string; order?: number }>()

  const [updated] = await db
    .update(bddScenarios)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(bddScenarios.id, scenarioId))
    .returning()

  if (!updated) return c.json({ error: 'not found' }, 404)
  await cache.del(`test:${testId}`)
  return c.json(updated)
})

router.delete('/:testId/scenarios/:scenarioId', requireAuth, async (c) => {
  const testId = Number(c.req.param('testId'))
  const scenarioId = Number(c.req.param('scenarioId'))
  const [deleted] = await db.delete(bddScenarios).where(eq(bddScenarios.id, scenarioId)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  await cache.del(`test:${testId}`)
  return c.json({ success: true })
})

router.post('/:testId/scenarios/:scenarioId/steps', requireAuth, async (c) => {
  const testId = Number(c.req.param('testId'))
  const scenarioId = Number(c.req.param('scenarioId'))
  const body = await c.req.json<{
    type: 'given' | 'when' | 'then' | 'and' | 'but'
    text: string
    order?: number
  }>()
  if (!body.text?.trim()) return c.json({ error: 'text is required' }, 400)

  const [created] = await db
    .insert(bddSteps)
    .values({
      scenarioId,
      type: body.type,
      text: body.text.trim(),
      order: body.order ?? 0,
    })
    .returning()

  await cache.del(`test:${testId}`)
  return c.json(created, 201)
})

router.put('/:testId/scenarios/:scenarioId/steps/:stepId', requireAuth, async (c) => {
  const testId = Number(c.req.param('testId'))
  const stepId = Number(c.req.param('stepId'))
  const body = await c.req.json<{
    type?: 'given' | 'when' | 'then' | 'and' | 'but'
    text?: string
    order?: number
  }>()

  const [updated] = await db.update(bddSteps).set(body).where(eq(bddSteps.id, stepId)).returning()

  if (!updated) return c.json({ error: 'not found' }, 404)
  await cache.del(`test:${testId}`)
  return c.json(updated)
})

router.delete('/:testId/scenarios/:scenarioId/steps/:stepId', requireAuth, async (c) => {
  const testId = Number(c.req.param('testId'))
  const stepId = Number(c.req.param('stepId'))
  const [deleted] = await db.delete(bddSteps).where(eq(bddSteps.id, stepId)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  await cache.del(`test:${testId}`)
  return c.json({ success: true })
})

export default router
