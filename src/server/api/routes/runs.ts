import { Hono } from 'hono'
import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  testRuns,
  testPackItems,
  runResults,
  runStepResults,
  tests,
  testSteps,
  bddScenarios,
  bddSteps,
  folders,
  spaces,
} from '../../db/schema.js'
import { cache } from '../../cache/client.js'
import { requireAuth, requireAppRole } from '../middleware/auth.js'

// ─── Enriched result builder ──────────────────────────────────────────────────

async function enrichResults(rawResults: (typeof runResults.$inferSelect)[]) {
  if (!rawResults.length) return []
  const resultIds = rawResults.map((r) => r.id)
  const testIds = [...new Set(rawResults.map((r) => r.testId))]

  // Step results
  const stepResults = await db
    .select()
    .from(runStepResults)
    .where(inArray(runStepResults.runResultId, resultIds))

  // Tests
  const testsData = await db.select().from(tests).where(inArray(tests.id, testIds))
  const testMap = Object.fromEntries(testsData.map((t) => [t.id, t]))

  // Folders (immediate)
  const folderIds = [...new Set(testsData.map((t) => t.folderId))]
  const foldersData = folderIds.length
    ? await db.select().from(folders).where(inArray(folders.id, folderIds))
    : []
  const folderMap = Object.fromEntries(foldersData.map((f) => [f.id, f]))

  // Spaces
  const spaceIds = [...new Set(foldersData.map((f) => f.spaceId))]
  const spacesData = spaceIds.length
    ? await db.select().from(spaces).where(inArray(spaces.id, spaceIds))
    : []
  const spaceMap = Object.fromEntries(spacesData.map((s) => [s.id, s]))

  // All folders in affected spaces — needed to build ancestor paths
  const allFoldersInSpaces = spaceIds.length
    ? await db.select().from(folders).where(inArray(folders.spaceId, spaceIds))
    : []
  const allFolderMap = Object.fromEntries(allFoldersInSpaces.map((f) => [f.id, f]))

  /** Walk parentFolderId chain and return ordered folder names from root → immediate parent */
  function buildFolderPath(folderId: number | null): string[] {
    if (!folderId) return []
    const path: string[] = []
    let cur = allFolderMap[folderId]
    while (cur) {
      path.unshift(cur.name)
      cur = cur.parentFolderId != null ? allFolderMap[cur.parentFolderId] : undefined
    }
    // last entry IS the folder itself — drop it (it's the accordion title)
    path.pop()
    return path
  }

  // Step text
  const tradStepIds = stepResults.filter((s) => s.stepType === 'traditional').map((s) => s.stepId)
  const bddStepIds = stepResults.filter((s) => s.stepType === 'bdd').map((s) => s.stepId)
  const tradSteps = tradStepIds.length
    ? await db.select().from(testSteps).where(inArray(testSteps.id, tradStepIds))
    : []
  const bddStepsData = bddStepIds.length
    ? await db.select().from(bddSteps).where(inArray(bddSteps.id, bddStepIds))
    : []
  const tradStepMap = Object.fromEntries(tradSteps.map((s) => [s.id, s]))
  const bddStepMap = Object.fromEntries(bddStepsData.map((s) => [s.id, s]))

  // BDD scenarios — fetch once for all unique scenarioIds referenced by the bdd steps
  const scenarioIds = [...new Set(bddStepsData.map((s) => s.scenarioId))]
  const bddScenariosData = scenarioIds.length
    ? await db.select().from(bddScenarios).where(inArray(bddScenarios.id, scenarioIds))
    : []
  const bddScenarioMap = Object.fromEntries(bddScenariosData.map((s) => [s.id, s]))

  return rawResults.map((r) => {
    const test = testMap[r.testId]
    const folder = test ? folderMap[test.folderId] : null
    const space = folder ? spaceMap[folder.spaceId] : null
    return {
      ...r,
      testTitle: test?.title ?? '',
      testType: test?.type ?? 'traditional',
      preconditions: test?.preconditions ?? null,
      internalId: test?.internalId ?? null,
      priority: test?.priority ?? 'medium',
      tags: test?.tags ?? null,
      category: test?.category ?? null,
      folderId: test?.folderId ?? null,
      folderName: folder?.name ?? '',
      folderPath: buildFolderPath(test?.folderId ?? null),
      spaceId: folder?.spaceId ?? null,
      spaceName: space?.name ?? '',
      stepResults: stepResults
        .filter((s) => s.runResultId === r.id)
        .map((s) => {
          if (s.stepType === 'traditional') {
            const step = tradStepMap[s.stepId]
            return {
              ...s,
              action: step?.action ?? '',
              expectedResult: step?.expectedResult ?? null,
            }
          } else {
            const step = bddStepMap[s.stepId]
            const scenario = step ? bddScenarioMap[step.scenarioId] : null
            const keyword = step?.type ? step.type.charAt(0).toUpperCase() + step.type.slice(1) : ''
            return {
              ...s,
              action: step ? `${keyword} ${step.text}` : '',
              expectedResult: null,
              scenarioId: step?.scenarioId ?? null,
              scenarioName: scenario?.scenario ?? null,
              featureName: scenario?.feature ?? null,
            }
          }
        }),
    }
  })
}

const router = new Hono()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively collect all test IDs under a folder (including sub-folders). */
async function collectTestIdsForFolder(folderId: number): Promise<number[]> {
  const childFolders = await db.select().from(folders).where(eq(folders.parentFolderId, folderId))
  const directTests = await db
    .select({ id: tests.id })
    .from(tests)
    .where(eq(tests.folderId, folderId))

  const nestedIds = await Promise.all(childFolders.map((f) => collectTestIdsForFolder(f.id)))
  return [...directTests.map((t) => t.id), ...nestedIds.flat()]
}

/** Collect all test IDs under a space (all its folders, recursively). */
async function collectTestIdsForSpace(spaceId: number): Promise<number[]> {
  const rootFolders = await db
    .select()
    .from(folders)
    .where(eq(folders.spaceId, spaceId))
    // Only root-level folders; sub-folders are handled by collectTestIdsForFolder
    .all()
  const rootFolderIds = rootFolders.filter((f) => f.parentFolderId === null).map((f) => f.id)
  const ids = await Promise.all(rootFolderIds.map((id) => collectTestIdsForFolder(id)))
  return ids.flat()
}

/** Expand test pack items into a unique list of test IDs. */
async function expandPackItems(runId: number): Promise<number[]> {
  const items = await db.select().from(testPackItems).where(eq(testPackItems.runId, runId))
  const allIds: number[] = []

  for (const item of items) {
    if (item.scopeType === 'test') {
      allIds.push(item.scopeId)
    } else if (item.scopeType === 'folder') {
      allIds.push(...(await collectTestIdsForFolder(item.scopeId)))
    } else if (item.scopeType === 'space') {
      allIds.push(...(await collectTestIdsForSpace(item.scopeId)))
    }
  }

  return [...new Set(allIds)]
}

/** Create run_results + run_step_results rows for a list of test IDs. */
async function createRunResultRows(runId: number, testIds: number[]) {
  if (!testIds.length) return

  for (const testId of testIds) {
    const [result] = await db
      .insert(runResults)
      .values({
        runId,
        testId,
        status: 'pending',
      })
      .returning()

    const [test] = await db.select().from(tests).where(eq(tests.id, testId))
    if (!test) continue

    if (test.type === 'traditional') {
      const steps = await db.select().from(testSteps).where(eq(testSteps.testId, testId))
      if (steps.length) {
        await db.insert(runStepResults).values(
          steps.map((s) => ({
            runResultId: result.id,
            stepType: 'traditional' as const,
            stepId: s.id,
            status: 'pending' as const,
          }))
        )
      }
    } else {
      const scenarios = await db.select().from(bddScenarios).where(eq(bddScenarios.testId, testId))
      for (const scenario of scenarios) {
        const steps = await db.select().from(bddSteps).where(eq(bddSteps.scenarioId, scenario.id))
        if (steps.length) {
          await db.insert(runStepResults).values(
            steps.map((s) => ({
              runResultId: result.id,
              stepType: 'bdd' as const,
              stepId: s.id,
              status: 'pending' as const,
            }))
          )
        }
      }
    }
  }
}

// ─── Run CRUD ─────────────────────────────────────────────────────────────────

// GET /api/apps/:appId/runs
router.get('/', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'viewer')
  const key = `runs:app:${appId}`
  const cached = await cache.get<unknown[]>(key)
  if (cached) return c.json(cached)
  const all = await db.select().from(testRuns).where(eq(testRuns.appId, appId))
  // Attach test count per run
  const counts = all.length
    ? await db
        .select({ runId: runResults.runId, count: sql<number>`count(*)` })
        .from(runResults)
        .where(
          inArray(
            runResults.runId,
            all.map((r) => r.id)
          )
        )
        .groupBy(runResults.runId)
    : []
  const countMap = Object.fromEntries(counts.map((c) => [c.runId, Number(c.count)]))
  const enriched = all.map((r) => ({ ...r, testCount: countMap[r.id] ?? 0 }))
  await cache.set(key, enriched, 15)
  return c.json(enriched)
})

router.post('/', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'member')
  const body = await c.req.json<{
    name: string
    description?: string
    environment?: string
    createdBy: string
    pack: Array<{ scopeType: 'space' | 'folder' | 'test'; scopeId: number }>
  }>()

  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
  if (!body.createdBy?.trim()) return c.json({ error: 'createdBy is required' }, 400)

  const [run] = await db
    .insert(testRuns)
    .values({
      appId,
      name: body.name.trim(),
      description: body.description ?? null,
      environment: body.environment ?? null,
      status: 'pending',
      createdBy: body.createdBy,
    })
    .returning()

  // Pack is optional — runs can start empty and tests added later
  if (body.pack?.length) {
    await db
      .insert(testPackItems)
      .values(body.pack.map((p) => ({ runId: run.id, scopeType: p.scopeType, scopeId: p.scopeId })))
    const testIds = await expandPackItems(run.id)
    await createRunResultRows(run.id, testIds)
  }

  await cache.del(`runs:app:${appId}`)
  return c.json(run, 201)
})

router.get('/:runId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'viewer')
  const id = Number(c.req.param('runId'))
  const key = `run:${id}`
  const cached = await cache.get<typeof testRuns.$inferSelect>(key)
  if (cached) return c.json(cached)
  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, id))
  if (!run) return c.json({ error: 'not found' }, 404)
  await cache.set(key, run, 15)
  return c.json(run)
})

router.patch('/:runId/status', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'member')
  const id = Number(c.req.param('runId'))
  const body = await c.req.json<{
    status: 'pending' | 'running' | 'passed' | 'failed' | 'aborted'
  }>()

  const [updated] = await db
    .update(testRuns)
    .set({ status: body.status, updatedAt: new Date().toISOString() })
    .where(eq(testRuns.id, id))
    .returning()

  if (!updated) return c.json({ error: 'not found' }, 404)
  await cache.del(`runs:app:${appId}`, `run:${id}`)
  return c.json(updated)
})

router.delete('/:runId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'admin')
  const id = Number(c.req.param('runId'))
  const [deleted] = await db.delete(testRuns).where(eq(testRuns.id, id)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  await cache.del(`runs:app:${appId}`, `run:${id}`)
  return c.json({ success: true })
})

// POST /api/apps/:appId/runs/:runId/duplicate — clone a run with its pack + fresh results
router.post('/:runId/duplicate', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'member')
  const runId = Number(c.req.param('runId'))

  const [original] = await db.select().from(testRuns).where(eq(testRuns.id, runId))
  if (!original) return c.json({ error: 'not found' }, 404)

  const [newRun] = await db
    .insert(testRuns)
    .values({
      appId,
      name: `${original.name} (copy)`,
      description: original.description,
      environment: original.environment,
      status: 'pending',
      createdBy: original.createdBy,
    })
    .returning()

  // Copy pack items from the original run
  const packItems = await db.select().from(testPackItems).where(eq(testPackItems.runId, runId))
  if (packItems.length) {
    await db
      .insert(testPackItems)
      .values(
        packItems.map((p) => ({ runId: newRun.id, scopeType: p.scopeType, scopeId: p.scopeId }))
      )
    const testIds = await expandPackItems(newRun.id)
    await createRunResultRows(newRun.id, testIds)
  }

  await cache.del(`runs:app:${appId}`)
  return c.json(newRun, 201)
})

// ─── Results ──────────────────────────────────────────────────────────────────

// GET /api/apps/:appId/runs/:runId/results — all test results enriched with test/folder/step metadata
router.get('/:runId/results', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'viewer')
  const runId = Number(c.req.param('runId'))
  const rawResults = await db.select().from(runResults).where(eq(runResults.runId, runId))
  return c.json(await enrichResults(rawResults))
})

// POST /api/apps/:appId/runs/:runId/items — add tests to an existing run
router.post('/:runId/items', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'member')
  const runId = Number(c.req.param('runId'))
  const body = await c.req.json<{
    pack: Array<{ scopeType: 'space' | 'folder' | 'test'; scopeId: number }>
  }>()
  if (!body.pack?.length) return c.json({ error: 'pack must not be empty' }, 400)

  // Check run exists
  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, runId))
  if (!run) return c.json({ error: 'not found' }, 404)

  // Get existing test IDs already in run (avoid duplicates)
  const existing = await db.select().from(runResults).where(eq(runResults.runId, runId))
  const existingTestIds = new Set(existing.map((r) => r.testId))

  await db
    .insert(testPackItems)
    .values(body.pack.map((p) => ({ runId, scopeType: p.scopeType, scopeId: p.scopeId })))

  const allNewIds = await expandPackItems(runId)
  const toAdd = allNewIds.filter((id) => !existingTestIds.has(id))
  await createRunResultRows(runId, toAdd)

  await cache.del(`runs:app:${appId}`, `run:${runId}`)
  return c.json({ added: toAdd.length })
})

// POST /api/apps/:appId/runs/:runId/results/reset — reset all (or one folder's) results to pending
router.post('/:runId/results/reset', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'member')
  const runId = Number(c.req.param('runId'))
  const body = await c.req.json<{ folderId?: number }>().catch(() => ({}))

  let toReset: (typeof runResults.$inferSelect)[]
  if (body.folderId != null) {
    const testIds = await collectTestIdsForFolder(body.folderId)
    if (!testIds.length) return c.json({ reset: 0 })
    const all = await db.select().from(runResults).where(eq(runResults.runId, runId))
    toReset = all.filter((r) => testIds.includes(r.testId))
  } else {
    toReset = await db.select().from(runResults).where(eq(runResults.runId, runId))
  }

  for (const result of toReset) {
    await db
      .update(runResults)
      .set({ status: 'pending', notes: null, executedBy: null, executedAt: null })
      .where(eq(runResults.id, result.id))
    await db
      .update(runStepResults)
      .set({ status: 'pending', notes: null, executedAt: null })
      .where(eq(runStepResults.runResultId, result.id))
  }

  return c.json({ reset: toReset.length })
})

// POST /api/apps/:appId/runs/:runId/results/:resultId/reset — reset a single result to pending
router.post('/:runId/results/:resultId/reset', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'member')
  const resultId = Number(c.req.param('resultId'))

  await db
    .update(runResults)
    .set({ status: 'pending', notes: null, executedBy: null, executedAt: null })
    .where(eq(runResults.id, resultId))
  await db
    .update(runStepResults)
    .set({ status: 'pending', notes: null, executedAt: null })
    .where(eq(runStepResults.runResultId, resultId))

  return c.json({ reset: true })
})

// DELETE /api/apps/:appId/runs/:runId/results/:resultId — remove a test from the run
router.delete('/:runId/results/:resultId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'member')
  const resultId = Number(c.req.param('resultId'))

  await db.delete(runStepResults).where(eq(runStepResults.runResultId, resultId))
  const [deleted] = await db.delete(runResults).where(eq(runResults.id, resultId)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  await cache.del(`runs:app:${appId}`)
  return c.json({ success: true })
})

// PATCH /api/apps/:appId/runs/:runId/results/:resultId — mark a single test result
router.patch('/:runId/results/:resultId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'member')
  const resultId = Number(c.req.param('resultId'))
  const body = await c.req.json<{
    status: 'pass' | 'fail' | 'skip' | 'blocked'
    notes?: string
    executedBy?: string
    propagateToSteps?: boolean // if true, set all steps to same status
  }>()

  const [updated] = await db
    .update(runResults)
    .set({
      status: body.status,
      notes: body.notes ?? null,
      executedBy: body.executedBy ?? null,
      executedAt: new Date().toISOString(),
    })
    .where(eq(runResults.id, resultId))
    .returning()

  if (!updated) return c.json({ error: 'not found' }, 404)

  if (body.propagateToSteps) {
    const stepStatus =
      body.status === 'blocked' ? 'skip' : (body.status as 'pass' | 'fail' | 'skip')
    await db
      .update(runStepResults)
      .set({ status: stepStatus, executedAt: new Date().toISOString() })
      .where(eq(runStepResults.runResultId, resultId))
  }

  return c.json(updated)
})

// PATCH /api/apps/:appId/runs/:runId/results/bulk — mark a whole space or folder
// Body: { scopeType: 'space'|'folder', scopeId, status, executedBy?, propagateToSteps? }
router.patch('/:runId/results/bulk', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'member')
  const runId = Number(c.req.param('runId'))
  const body = await c.req.json<{
    scopeType: 'space' | 'folder'
    scopeId: number
    status: 'pass' | 'fail' | 'skip' | 'blocked'
    executedBy?: string
    propagateToSteps?: boolean
  }>()

  let testIds: number[]
  if (body.scopeType === 'space') {
    testIds = await collectTestIdsForSpace(body.scopeId)
  } else {
    testIds = await collectTestIdsForFolder(body.scopeId)
  }

  if (!testIds.length) return c.json({ updated: 0 })

  const affected = await db.select().from(runResults).where(eq(runResults.runId, runId)).all()
  const toUpdate = affected.filter((r) => testIds.includes(r.testId))

  for (const result of toUpdate) {
    await db
      .update(runResults)
      .set({
        status: body.status,
        executedBy: body.executedBy ?? null,
        executedAt: new Date().toISOString(),
      })
      .where(eq(runResults.id, result.id))

    if (body.propagateToSteps) {
      const stepStatus =
        body.status === 'blocked' ? 'skip' : (body.status as 'pass' | 'fail' | 'skip')
      await db
        .update(runStepResults)
        .set({ status: stepStatus, executedAt: new Date().toISOString() })
        .where(eq(runStepResults.runResultId, result.id))
    }
  }

  return c.json({ updated: toUpdate.length })
})

// PATCH /api/apps/:appId/runs/:runId/results/:resultId/steps/:stepResultId
router.patch('/:runId/results/:resultId/steps/:stepResultId', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'member')
  const stepResultId = Number(c.req.param('stepResultId'))
  const body = await c.req.json<{ status: 'pass' | 'fail' | 'skip'; notes?: string }>()

  const [updated] = await db
    .update(runStepResults)
    .set({ status: body.status, notes: body.notes ?? null, executedAt: new Date().toISOString() })
    .where(eq(runStepResults.id, stepResultId))
    .returning()

  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

// ─── Report ───────────────────────────────────────────────────────────────────

// GET /api/apps/:appId/runs/:runId/report
router.get('/:runId/report', requireAuth, async (c) => {
  const appId = Number(c.req.param('appId'))
  await requireAppRole(c, appId, 'viewer')
  const runId = Number(c.req.param('runId'))
  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, runId))
  if (!run) return c.json({ error: 'not found' }, 404)

  const results = await db.select().from(runResults).where(eq(runResults.runId, runId))

  const counts = { total: results.length, pass: 0, fail: 0, skip: 0, blocked: 0, pending: 0 }
  for (const r of results) {
    counts[r.status as keyof typeof counts]++
  }

  return c.json({
    run,
    summary: {
      ...counts,
      passRate: counts.total ? Math.round((counts.pass / counts.total) * 100) : 0,
    },
    results,
  })
})

export default router
