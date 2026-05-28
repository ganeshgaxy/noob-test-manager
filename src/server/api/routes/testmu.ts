import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  tests,
  testSteps,
  bddScenarios,
  bddSteps,
  folders,
  spaces,
  globalTags,
} from '../../db/schema.js'
import { cache } from '../../cache/client.js'
import { requireAuth } from '../middleware/auth.js'

const router = new Hono()

// ─── Types (TestMu API shapes) ────────────────────────────────────────────────

interface TmFolder {
  folder_id?: number | string
  id?: number | string
  name: string
  description?: string | null
  parent_folder_id?: number | string | null
  parent_id?: number | string | null
  sub_folders?: TmFolder[]
  children?: TmFolder[]
  folders?: TmFolder[]
}

interface TmStep {
  description?: string
  outcome?: string
  serial_no?: number
  action?: string
  step?: string
  expected_result?: string
  expected?: string
  order?: number
}

interface TmBddScenario {
  scenario?: string
  title?: string
  feature?: string
  order?: number
  steps?: Array<{
    type?: string
    step_type?: string
    text?: string
    step?: string
    order?: number
  }>
}

interface TmTestCase {
  test_case_id?: number | string
  id?: number | string
  title?: string
  name?: string
  description?: string
  preconditions?: string
  priority?: string
  status?: string
  estimated_time?: number
  automation_status?: string
  type?: string
  folder_id?: number | string
  test_steps?: TmStep[]
  steps?: TmStep[]
  bdd_scenarios?: TmBddScenario[]
  tags?: Array<string | { name?: string; tag?: string; tag_id?: number; id?: number }>
  jira_details?: Array<{ jira_id?: string }>
  data?: TmTestCase
}

// ─── SSE event shapes ─────────────────────────────────────────────────────────

interface ImportEvent {
  type: 'activity' | 'folder-created' | 'test-created' | 'project-done' | 'project-error' | 'done'
  projectId?: string
  msg?: string
  error?: string
}

// ─── Field maps ───────────────────────────────────────────────────────────────

const PRIORITY_MAP: Record<string, string> = {
  normal: 'Normal',
  low: 'Low',
  high: 'High',
  critical: 'High',
  highest: 'Highest',
  lowest: 'Lowest',
  medium: 'Medium',
  p0: 'Highest',
  p1: 'High',
  p2: 'Medium',
  p3: 'Low',
}

const STATUS_MAP: Record<string, string> = {
  ready: 'Ready',
  live: 'Live',
  archived: 'Archived',
  draft: 'Draft',
  deprecated: 'Deprecated',
  unverified: 'Unverified',
  faulty: 'Faulty',
  active: 'Ready',
  published: 'Live',
}

const TYPE_MAP: Record<string, string> = {
  functional: 'Functional',
  regression: 'Regression',
  'smoke & sanity': 'Smoke & Sanity',
  smoke: 'Smoke & Sanity',
  security: 'Security',
  performance: 'Performance',
  integration: 'Integration',
  accessibility: 'Accessibility',
  acceptance: 'Acceptance',
  compatibility: 'Compatibility',
  destructive: 'Destructive',
  'user interface': 'User Interface',
  usability: 'Usability',
  other: 'Other',
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getV2BaseUrl(v1Url: string): string {
  return v1Url.replace(/\/v\d+\/?$/, '/v2')
}

function flattenFolderTree(nodes: TmFolder[], resolvedParentId: string | null = null): TmFolder[] {
  const result: TmFolder[] = []
  for (const node of nodes) {
    const fid = String(node.folder_id ?? node.id ?? '')
    result.push({
      ...node,
      parent_id: resolvedParentId ?? node.parent_id ?? node.parent_folder_id ?? null,
    })
    const kids = node.sub_folders ?? node.children ?? node.folders ?? []
    if (kids.length > 0) result.push(...flattenFolderTree(kids, fid))
  }
  return result
}

const TM_PAGE_SIZE = 250 // max results per page when paginating

/** Direct server → TestMu HTTP fetch with retry + backoff for 429/5xx. */
async function tmGet<T>(
  encoded: string,
  baseUrl: string,
  endpoint: string,
  params?: Record<string, string>,
  attempt = 0
): Promise<T> {
  let url = `${baseUrl.replace(/\/$/, '')}${endpoint}`
  if (params && Object.keys(params).length > 0) {
    url += '?' + new URLSearchParams(params).toString()
  }
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${encoded}`, Accept: 'application/json' },
  })

  // Retry on rate-limit or server errors (up to 4 attempts: 0, 1s, 2s, 4s)
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const delay = Math.pow(2, attempt) * 1000
    await new Promise((r) => setTimeout(r, delay))
    return tmGet<T>(encoded, baseUrl, endpoint, params, attempt + 1)
  }

  if (!res.ok) throw new Error(`TestMu ${res.status}: ${endpoint}`)
  return res.json() as Promise<T>
}

/**
 * Fetch ALL pages from a paginated TestMu list endpoint.
 * Returns a flat array of raw items regardless of the response envelope shape.
 */
async function tmGetAllPages(
  encoded: string,
  baseUrl: string,
  endpoint: string,
  extraParams?: Record<string, string>
): Promise<Array<Record<string, unknown>>> {
  const extractList = (data: unknown): Array<Record<string, unknown>> => {
    if (Array.isArray(data)) return data as Array<Record<string, unknown>>
    if (data && typeof data === 'object') {
      // Look for the first array value in the response object
      const obj = data as Record<string, unknown>
      // Common nested shapes: data.test_cases, data.data, data[anything-array]
      for (const key of ['test_cases', 'testCases', 'data', 'items', 'results']) {
        if (Array.isArray(obj[key])) return obj[key] as Array<Record<string, unknown>>
      }
      // fallback: find any array value
      const found = Object.values(obj).find((v) => Array.isArray(v))
      if (found) return found as Array<Record<string, unknown>>
    }
    return []
  }

  const params = { per_page: String(TM_PAGE_SIZE), page: '1', ...extraParams }
  const first = await tmGet<unknown>(encoded, baseUrl, endpoint, params)
  const firstList = extractList(first)

  // Try to derive total page count from metadata
  const meta =
    (first as Record<string, unknown>)?.meta ??
    (first as Record<string, unknown>)?.pagination ??
    (first as Record<string, unknown>)?.paginate ??
    {}
  const metaObj = meta as Record<string, unknown>
  const total = Number(
    metaObj.total ?? metaObj.total_count ?? (first as Record<string, unknown>)?.total ?? 0
  )
  const lastPage = Number(
    metaObj.last_page ??
      metaObj.total_pages ??
      metaObj.totalPages ??
      Math.ceil(total / TM_PAGE_SIZE)
  )

  // If we got fewer items than page size, or can't determine pages, we're done
  if (lastPage <= 1 || firstList.length < TM_PAGE_SIZE) return firstList

  // Fetch remaining pages in parallel
  const remainingPages = Array.from({ length: lastPage - 1 }, (_, i) => i + 2)
  const rest = await Promise.all(
    remainingPages.map(async (page) => {
      const data = await tmGet<unknown>(encoded, baseUrl, endpoint, {
        ...params,
        page: String(page),
      })
      return extractList(data)
    })
  )

  return [...firstList, ...rest.flat()]
}

/** Run fn over items with at most `concurrency` in-flight. Failures are skipped. */
async function serverPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (!items.length) return
  let idx = 0
  const worker = async () => {
    while (idx < items.length) {
      const i = idx++
      try {
        await fn(items[i])
      } catch {
        /* skip bad item, keep going */
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function dbCreateSpace(appId: number, name: string, description?: string): Promise<number> {
  const [s] = await db
    .insert(spaces)
    .values({ appId, name, description: description ?? null })
    .returning({ id: spaces.id })
  return s.id
}

async function dbCreateFolder(
  spaceId: number,
  name: string,
  description?: string | null,
  parentFolderId?: number | null
): Promise<number> {
  const [f] = await db
    .insert(folders)
    .values({
      spaceId,
      name,
      description: description ?? null,
      parentFolderId: parentFolderId ?? null,
    })
    .returning({ id: folders.id })
  return f.id
}

/** Upsert a tag name into global_tags. Returns the global tag id. */
async function dbUpsertGlobalTag(name: string): Promise<void> {
  await db.insert(globalTags).values({ name }).onConflictDoNothing()
}

async function dbCreateTest(
  folderId: number,
  _appId: number,
  payload: {
    type: 'traditional' | 'bdd'
    title: string
    description?: string
    preconditions?: string
    priority?: string
    status?: string
    estimatedTime?: number
    automationStatus?: string
    category?: string
    jiraIssueKey?: string
    tagNames?: string[]
  }
): Promise<number> {
  const tagNames = payload.tagNames ?? []
  const [created] = await db
    .insert(tests)
    .values({
      folderId,
      type: payload.type,
      title: payload.title,
      description: payload.description ?? null,
      preconditions: payload.preconditions ?? null,
      priority: (payload.priority as (typeof tests.$inferInsert)['priority']) ?? 'Medium',
      status: (payload.status as (typeof tests.$inferInsert)['status']) ?? 'Draft',
      estimatedTime: payload.estimatedTime ?? null,
      automationStatus:
        (payload.automationStatus as (typeof tests.$inferInsert)['automationStatus']) ?? null,
      category: (payload.category as (typeof tests.$inferInsert)['category']) ?? null,
      jiraIssueKey: payload.jiraIssueKey ?? null,
      tags: tagNames.length > 0 ? JSON.stringify(tagNames) : null,
      createdBy: 'testmu-import',
      updatedBy: 'testmu-import',
    })
    .returning({ id: tests.id })

  const internalId = `TC${created.id + 100000}`
  await db.update(tests).set({ internalId }).where(eq(tests.id, created.id))

  // Upsert each tag name into global_tags — idempotent, existing ones are skipped
  if (tagNames.length > 0) {
    await Promise.all(tagNames.map((n) => dbUpsertGlobalTag(n)))
  }

  return created.id
}

async function dbCreateStepsBulk(
  testId: number,
  steps: Array<{ action: string; expectedResult?: string; order: number }>
): Promise<void> {
  if (!steps.length) return
  await db.insert(testSteps).values(
    steps.map((s) => ({
      testId,
      action: s.action,
      expectedResult: s.expectedResult ?? null,
      order: s.order,
    }))
  )
}

async function dbCreateScenario(
  testId: number,
  scenario: TmBddScenario,
  order: number
): Promise<void> {
  const [sc] = await db
    .insert(bddScenarios)
    .values({
      testId,
      feature: scenario.feature ?? null,
      scenario: scenario.scenario ?? scenario.title ?? 'Scenario',
      order,
    })
    .returning({ id: bddScenarios.id })

  const steps = (scenario.steps ?? [])
    .map((s, i) => ({
      scenarioId: sc.id,
      type: (s.type ?? s.step_type ?? 'given') as 'given' | 'when' | 'then' | 'and' | 'but',
      text: s.text ?? s.step ?? '',
      order: s.order ?? i,
    }))
    .filter((s) => s.text)

  if (steps.length) {
    await db.insert(bddSteps).values(steps)
  }
}

// ─── Core import logic ────────────────────────────────────────────────────────

const PROJECT_CONCURRENCY = 3
const TEST_CONCURRENCY = 8 // flat pool — kept conservative to avoid TM rate limits

async function importAllProjects(
  projects: Array<{ project_id: number | string; name: string; description?: string }>,
  appId: number,
  baseUrl: string,
  username: string,
  accessKey: string,
  send: (event: ImportEvent) => void
): Promise<void> {
  const encoded = Buffer.from(`${username}:${accessKey}`).toString('base64')
  const v2BaseUrl = getV2BaseUrl(baseUrl)

  await serverPool(projects, PROJECT_CONCURRENCY, async (project) => {
    const projectId = String(project.project_id)

    try {
      // ── 1. Create space ──────────────────────────────────────────────────────
      send({ type: 'activity', projectId, msg: 'Creating space…' })
      const spaceId = await dbCreateSpace(appId, project.name, project.description)

      // ── 2. Fetch TM folders ──────────────────────────────────────────────────
      send({ type: 'activity', projectId, msg: 'Fetching folders…' })
      let tmFolders: TmFolder[] = []
      try {
        const folderRes = await tmGet<Record<string, unknown>>(
          encoded,
          baseUrl,
          `/folder/entity/${projectId}`
        )
        let raw: TmFolder[] = []
        if (Array.isArray(folderRes)) raw = folderRes as TmFolder[]
        else if (Array.isArray(folderRes.data)) raw = folderRes.data as TmFolder[]
        else if (folderRes.data && typeof folderRes.data === 'object') {
          const d = folderRes.data as Record<string, unknown>
          if (Array.isArray(d.folders)) raw = d.folders as TmFolder[]
          else if (Array.isArray(d.sub_folders)) raw = d.sub_folders as TmFolder[]
          else raw = [folderRes.data as TmFolder]
        } else if (Array.isArray(folderRes.folders)) {
          raw = folderRes.folders as TmFolder[]
        }
        tmFolders = flattenFolderTree(raw)
      } catch {
        /* fall through to default folder */
      }

      // ── 3. Create folders topologically — siblings in parallel ───────────────
      const folderIdMap = new Map<string, number>()
      const getFid = (f: TmFolder) => String(f.folder_id ?? f.id ?? '')
      const getParentFid = (f: TmFolder): string | null => {
        const pid = f.parent_folder_id ?? f.parent_id
        return pid == null || pid === 0 || pid === '' ? null : String(pid)
      }

      if (tmFolders.length > 0) {
        const knownIds = new Set(tmFolders.map(getFid).filter(Boolean))
        const isRoot = (f: TmFolder) => {
          const pid = getParentFid(f)
          return pid === null || !knownIds.has(pid)
        }

        const createChildren = async (parentTmId: string, parentOurId: number): Promise<void> => {
          const siblings = tmFolders.filter((f) => getParentFid(f) === parentTmId)
          await Promise.all(
            siblings.map(async (f) => {
              const fid = getFid(f)
              if (!fid || folderIdMap.has(fid)) return
              const ourId = await dbCreateFolder(spaceId, f.name, f.description, parentOurId)
              folderIdMap.set(fid, ourId)
              send({ type: 'folder-created', projectId })
              await createChildren(fid, ourId)
            })
          )
        }

        await Promise.all(
          tmFolders.filter(isRoot).map(async (f) => {
            const fid = getFid(f)
            if (!fid || folderIdMap.has(fid)) return
            const ourId = await dbCreateFolder(spaceId, f.name, f.description, null)
            folderIdMap.set(fid, ourId)
            send({ type: 'folder-created', projectId })
            await createChildren(fid, ourId)
          })
        )
      }

      if (folderIdMap.size === 0) {
        const ourId = await dbCreateFolder(spaceId, 'Imported Tests', null, null)
        folderIdMap.set('__default__', ourId)
        send({ type: 'folder-created', projectId })
      }

      // ── 4. Phase A: Fetch ALL folder test-ID lists in parallel (all pages) ────
      send({ type: 'activity', projectId, msg: 'Fetching test lists…' })
      const folderEntries = Array.from(folderIdMap.entries())

      // [(tcId, ourFolderId), ...] — flat list across all folders
      const allTests: Array<{ tcId: string; ourFolderId: number }> = []

      // Real TM folder IDs only — skip the '__default__' sentinel
      const realFolderEntries = folderEntries.filter(([tmId]) => tmId !== '__default__')
      const hasDefaultOnly = realFolderEntries.length === 0 && folderIdMap.has('__default__')

      if (hasDefaultOnly) {
        // Folder fetch failed — fall back to project-level test list (no folder filter)
        try {
          const list = await tmGetAllPages(encoded, baseUrl, `/projects/${projectId}/test-cases`)
          for (const tc of list) {
            const tcId = String(tc.test_case_id ?? tc.id ?? '')
            if (tcId) allTests.push({ tcId, ourFolderId: folderIdMap.get('__default__')! })
          }
        } catch {
          /* best effort */
        }
      } else {
        await Promise.all(
          realFolderEntries.map(async ([tmFolderIdStr, ourFolderId]) => {
            try {
              const list = await tmGetAllPages(
                encoded,
                baseUrl,
                `/projects/${projectId}/folder/${tmFolderIdStr}/test-cases`
              )
              for (const tc of list) {
                const tcId = String(tc.test_case_id ?? tc.id ?? '')
                if (tcId) allTests.push({ tcId, ourFolderId })
              }
            } catch {
              /* skip this folder */
            }
          })
        )
      }

      // ── 5. Phase B: Single flat pool — fetch details + create test + steps ───
      send({ type: 'activity', projectId, msg: `Importing ${allTests.length} tests…` })

      // Collect folder IDs touched so we can batch cache invalidation at the end
      const touchedFolders = new Set<number>()

      await serverPool(allTests, TEST_CONCURRENCY, async ({ tcId, ourFolderId }) => {
        const raw = await tmGet<TmTestCase>(encoded, v2BaseUrl, `/test-cases/${tcId}`)
        const tc = raw.data ?? raw
        const title = tc.title ?? tc.name ?? 'Untitled'
        const hasBdd = Array.isArray(tc.bdd_scenarios) && tc.bdd_scenarios.length > 0

        const tagNames = (tc.tags ?? [])
          .map((t) => (typeof t === 'string' ? t : (t.name ?? t.tag ?? '')))
          .filter(Boolean)

        const testId = await dbCreateTest(ourFolderId, appId, {
          type: hasBdd ? 'bdd' : 'traditional',
          title,
          description: tc.description || undefined,
          preconditions: tc.preconditions || undefined,
          priority: PRIORITY_MAP[tc.priority?.toLowerCase() ?? ''] ?? 'Medium',
          status: STATUS_MAP[tc.status?.toLowerCase() ?? ''] ?? 'Draft',
          estimatedTime: tc.estimated_time,
          automationStatus: tc.automation_status,
          category: TYPE_MAP[tc.type?.toLowerCase() ?? ''] ?? 'Manual',
          jiraIssueKey: tc.jira_details?.[0]?.jira_id ?? undefined,
          tagNames,
        })

        if (hasBdd) {
          await Promise.all(
            (tc.bdd_scenarios ?? []).map((scenario, i) => dbCreateScenario(testId, scenario, i))
          )
        } else {
          const steps = (tc.test_steps ?? tc.steps ?? [])
            .map((s, i) => ({
              action: s.action || s.description || s.step || '',
              expectedResult: s.outcome || s.expected_result || s.expected || undefined,
              order: s.serial_no ?? s.order ?? i,
            }))
            .filter((s) => s.action || s.expectedResult)
            .map((s) => ({
              ...s,
              action: s.action || s.expectedResult || '',
              expectedResult: s.action ? s.expectedResult : undefined,
            }))

          await dbCreateStepsBulk(testId, steps)
        }

        touchedFolders.add(ourFolderId)
        send({ type: 'test-created', projectId })
      })

      // ── 6. Batch cache invalidation — one del per unique folder ──────────────
      const cacheKeys = Array.from(touchedFolders).flatMap((fid) => [
        `tests:folder:${fid}`,
        `folders:space:${fid}`,
      ])
      if (cacheKeys.length) await cache.del(...cacheKeys)

      send({ type: 'project-done', projectId })
    } catch (err) {
      send({
        type: 'project-error',
        projectId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })

  send({ type: 'done' })
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Legacy proxy — kept for one-off API exploration from the client. */
router.post('/proxy', async (c) => {
  const body = await c.req.json<{
    baseUrl: string
    username: string
    accessKey: string
    endpoint: string
    params?: Record<string, string>
  }>()

  const { baseUrl, username, accessKey, endpoint, params } = body

  if (!baseUrl || !username || !accessKey || !endpoint) {
    return c.json({ error: 'baseUrl, username, accessKey, and endpoint are required' }, 400)
  }

  const encoded = Buffer.from(`${username}:${accessKey}`).toString('base64')

  let url = `${baseUrl.replace(/\/$/, '')}${endpoint}`
  if (params && Object.keys(params).length > 0) {
    url += '?' + new URLSearchParams(params).toString()
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${encoded}`,
        Accept: 'application/json',
      },
    })

    const data: unknown = await res.json()
    return c.json(data as Record<string, unknown>, res.status as 200)
  } catch (err) {
    return c.json({ error: `Failed to reach TestMu API: ${String(err)}` }, 502)
  }
})

/** Server-side import with SSE progress streaming. */
router.post('/import', requireAuth, async (c) => {
  const body = await c.req.json<{
    baseUrl: string
    username: string
    accessKey: string
    appId: number
    projects: Array<{ project_id: number | string; name: string; description?: string }>
  }>()

  const { baseUrl, username, accessKey, appId, projects } = body

  if (!baseUrl || !username || !accessKey || !appId || !projects?.length) {
    return c.json({ error: 'baseUrl, username, accessKey, appId, and projects are required' }, 400)
  }

  const enc = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ImportEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          /* client disconnected */
        }
      }

      importAllProjects(projects, appId, baseUrl, username, accessKey, send)
        .catch((err) => {
          send({ type: 'done' })
          try {
            controller.error(err)
          } catch {
            /* already closed */
          }
        })
        .finally(() => {
          try {
            controller.close()
          } catch {
            /* already closed */
          }
        })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})

export { router as testmuRouter }
