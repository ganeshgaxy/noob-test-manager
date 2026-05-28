import { Hono } from 'hono'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { apps, appMembers, appGroupAccess, groupMembers, users } from '../../db/schema.js'
import { cache } from '../../cache/client.js'
import { requireAuth, requireAppRole, requireSuperAdmin } from '../middleware/auth.js'

const router = new Hono()

router.get('/', requireAuth, async (c) => {
  const user = c.get('user') as typeof users.$inferSelect

  // super_admin sees all apps — use cache
  if (user.globalRole === 'super_admin') {
    const cached = await cache.get<(typeof apps.$inferSelect)[]>('apps:all')
    if (cached) return c.json(cached)
    const all = await db.select().from(apps).all()
    await cache.set('apps:all', all)
    return c.json(all)
  }

  // Normal member: only apps accessible via direct or group membership
  const [directRows, groupRows] = await Promise.all([
    db.select({ appId: appMembers.appId }).from(appMembers).where(eq(appMembers.userId, user.id)),
    db
      .select({ appId: appGroupAccess.appId })
      .from(appGroupAccess)
      .innerJoin(groupMembers, eq(appGroupAccess.groupId, groupMembers.groupId))
      .where(eq(groupMembers.userId, user.id)),
  ])

  const accessibleIds = [
    ...new Set([...directRows.map((r) => r.appId), ...groupRows.map((r) => r.appId)]),
  ]

  if (accessibleIds.length === 0) return c.json([])

  const all = await db.select().from(apps).where(inArray(apps.id, accessibleIds))
  return c.json(all)
})

router.post('/', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const body = await c.req.json<{ name: string; description?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)

  try {
    const [created] = await db
      .insert(apps)
      .values({
        name: body.name.trim(),
        description: body.description ?? null,
      })
      .returning()
    await cache.del('apps:all')
    return c.json(created, 201)
  } catch (err) {
    console.error('[POST /api/apps]', err)
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

router.get('/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  await requireAppRole(c, id, 'viewer')
  const key = `app:${id}`
  const cached = await cache.get<typeof apps.$inferSelect>(key)
  if (cached) return c.json(cached)
  const [app] = await db.select().from(apps).where(eq(apps.id, id))
  if (!app) return c.json({ error: 'not found' }, 404)
  await cache.set(key, app)
  return c.json(app)
})

router.put('/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  await requireAppRole(c, id, 'admin')
  const body = await c.req.json<{ name?: string; description?: string }>()

  try {
    const [updated] = await db
      .update(apps)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(apps.id, id))
      .returning()
    if (!updated) return c.json({ error: 'not found' }, 404)
    await cache.del('apps:all', `app:${id}`)
    return c.json(updated)
  } catch (err) {
    console.error('[PUT /api/apps/:id]', err)
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

router.delete('/:id', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const id = Number(c.req.param('id'))
  const [deleted] = await db.delete(apps).where(eq(apps.id, id)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  await cache.del('apps:all', `app:${id}`)
  return c.json({ success: true })
})

export default router
