import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { customFields, customFieldValues, appSettings, appIntegrations } from '../../db/schema.js'

// ─── Fields router — mounted at /api/apps/:appId/fields ──────────────────────

export const fieldsRouter = new Hono()

fieldsRouter.get('/', async (c) => {
  const appId = Number(c.req.param('appId'))
  const fields = await db.select().from(customFields).where(eq(customFields.appId, appId)).all()
  return c.json(fields)
})

fieldsRouter.post('/', async (c) => {
  const appId = Number(c.req.param('appId'))
  const body = await c.req.json<{
    name: string
    type: string
    options?: string[]
    required?: boolean
    defaultValue?: string
    order?: number
  }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)

  const existing = await db.select().from(customFields).where(eq(customFields.appId, appId)).all()
  const [created] = await db
    .insert(customFields)
    .values({
      appId,
      name: body.name.trim(),
      type: (body.type as (typeof customFields.$inferInsert)['type']) ?? 'text',
      options: body.options ? JSON.stringify(body.options) : null,
      required: body.required ?? false,
      defaultValue: body.defaultValue ?? null,
      order: body.order ?? existing.length,
    })
    .returning()
  return c.json(created, 201)
})

fieldsRouter.get('/values/:testId', async (c) => {
  const testId = Number(c.req.param('testId'))
  const values = await db
    .select()
    .from(customFieldValues)
    .where(eq(customFieldValues.testId, testId))
    .all()
  return c.json(values)
})

fieldsRouter.put('/values/:testId', async (c) => {
  const testId = Number(c.req.param('testId'))
  const body = await c.req.json<{ fieldId: number; value: string }>()

  const existing = await db
    .select()
    .from(customFieldValues)
    .where(and(eq(customFieldValues.testId, testId), eq(customFieldValues.fieldId, body.fieldId)))
    .all()

  if (existing.length > 0) {
    const [updated] = await db
      .update(customFieldValues)
      .set({ value: body.value })
      .where(and(eq(customFieldValues.testId, testId), eq(customFieldValues.fieldId, body.fieldId)))
      .returning()
    return c.json(updated)
  }

  const [created] = await db
    .insert(customFieldValues)
    .values({
      testId,
      fieldId: body.fieldId,
      value: body.value,
    })
    .returning()
  return c.json(created, 201)
})

fieldsRouter.put('/:fieldId', async (c) => {
  const fieldId = Number(c.req.param('fieldId'))
  const body = await c.req.json<{
    name?: string
    type?: string
    options?: string[]
    required?: boolean
    defaultValue?: string
    order?: number
  }>()

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.type !== undefined) updates.type = body.type
  if (body.options !== undefined) updates.options = JSON.stringify(body.options)
  if (body.required !== undefined) updates.required = body.required
  if (body.defaultValue !== undefined) updates.defaultValue = body.defaultValue
  if (body.order !== undefined) updates.order = body.order

  const [updated] = await db
    .update(customFields)
    .set(updates as Parameters<typeof db.update>[0]['set'])
    .where(eq(customFields.id, fieldId))
    .returning()
  if (!updated) return c.json({ error: 'not found' }, 404)
  return c.json(updated)
})

fieldsRouter.delete('/:fieldId', async (c) => {
  const fieldId = Number(c.req.param('fieldId'))
  const [deleted] = await db.delete(customFields).where(eq(customFields.id, fieldId)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

// ─── App settings router — mounted at /api/apps/:appId/app-settings ──────────

export const appSettingsRouter = new Hono()

appSettingsRouter.get('/', async (c) => {
  const appId = Number(c.req.param('appId'))
  const rows = await db.select().from(appSettings).where(eq(appSettings.appId, appId)).all()
  const result: Record<string, unknown> = {}
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value)
    } catch {
      result[row.key] = row.value
    }
  }
  return c.json(result)
})

appSettingsRouter.put('/:key', async (c) => {
  const appId = Number(c.req.param('appId'))
  const key = c.req.param('key')
  const body = await c.req.json<{ value: unknown }>()
  const valueStr = JSON.stringify(body.value)

  const existing = await db
    .select()
    .from(appSettings)
    .where(and(eq(appSettings.appId, appId), eq(appSettings.key, key)))
    .all()

  if (existing.length > 0) {
    const [updated] = await db
      .update(appSettings)
      .set({ value: valueStr })
      .where(and(eq(appSettings.appId, appId), eq(appSettings.key, key)))
      .returning()
    return c.json(updated)
  }

  const [created] = await db.insert(appSettings).values({ appId, key, value: valueStr }).returning()
  return c.json(created, 201)
})

// ─── Integrations router — mounted at /api/apps/:appId/integrations ──────────

export const integrationsRouter = new Hono()

integrationsRouter.get('/', async (c) => {
  const appId = Number(c.req.param('appId'))
  const rows = await db.select().from(appIntegrations).where(eq(appIntegrations.appId, appId)).all()
  return c.json(rows.map((r) => ({ ...r, config: JSON.parse(r.config) })))
})

integrationsRouter.put('/:type', async (c) => {
  const appId = Number(c.req.param('appId'))
  const type = c.req.param('type') as 'jira' | 'github' | 'slack'
  const body = await c.req.json<{ config: Record<string, string>; enabled?: boolean }>()
  const configStr = JSON.stringify(body.config ?? {})
  const now = new Date().toISOString()

  const existing = await db
    .select()
    .from(appIntegrations)
    .where(and(eq(appIntegrations.appId, appId), eq(appIntegrations.type, type)))
    .all()

  if (existing.length > 0) {
    const [updated] = await db
      .update(appIntegrations)
      .set({ config: configStr, enabled: body.enabled ?? true, updatedAt: now })
      .where(and(eq(appIntegrations.appId, appId), eq(appIntegrations.type, type)))
      .returning()
    return c.json({ ...updated, config: JSON.parse(updated.config) })
  }

  const [created] = await db
    .insert(appIntegrations)
    .values({
      appId,
      type,
      config: configStr,
      enabled: body.enabled ?? true,
    })
    .returning()
  return c.json({ ...created, config: JSON.parse(created.config) }, 201)
})

integrationsRouter.delete('/:type', async (c) => {
  const appId = Number(c.req.param('appId'))
  const type = c.req.param('type')
  const [deleted] = await db
    .delete(appIntegrations)
    .where(
      and(
        eq(appIntegrations.appId, appId),
        eq(appIntegrations.type, type as 'jira' | 'github' | 'slack')
      )
    )
    .returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})
