import { Hono } from 'hono'
import { readDbConfig, writeDbConfig, type DbConfig } from '../../db/config.js'
import { initDb } from '../../db/client.js'
import { createClient } from '@libsql/client'
import pg from 'pg'
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js'

const router = new Hono()

/** GET /api/db-config — returns current config (token is redacted) */
router.get('/', async (c) => {
  const config = await readDbConfig()
  return c.json({
    type: config.type,
    url: config.type === 'sqlite' ? config.url : config.url,
    hasToken: !!config.token,
    poolMax: config.poolMax ?? 10,
    connected: true,
  })
})

/** POST /api/db-config/test — test a connection without saving it */
router.post('/test', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const body = (await c.req.json()) as Partial<DbConfig>
  const { type, url, token } = body

  if (!type || !url) return c.json({ ok: false, error: 'type and url are required' }, 400)

  try {
    if (type === 'postgres') {
      // Attempt a real connection using a temporary pg.Client (not the pool)
      const pgClient = new pg.Client({ connectionString: url })
      try {
        await pgClient.connect()
        await pgClient.query('SELECT 1')
        return c.json({ ok: true, message: 'PostgreSQL connection successful.' })
      } finally {
        await pgClient.end().catch(() => {})
      }
    }

    // SQLite / Turso — attempt a real connection
    const client = createClient({ url, ...(token ? { authToken: token } : {}) })
    await client.execute('SELECT 1')
    await client.close()
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 400)
  }
})

/** PUT /api/db-config — save and apply new connection */
router.put('/', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const body = (await c.req.json()) as Partial<DbConfig>
  const { type, url, token, poolMax } = body

  if (!type || !url) return c.json({ error: 'type and url are required' }, 400)

  const config: DbConfig = {
    type,
    url,
    ...(token ? { token } : {}),
    ...(poolMax ? { poolMax: Number(poolMax) } : {}),
  }

  try {
    // Persist first, then reinit the live connection for all DB types
    await writeDbConfig(config)
    await initDb(config)
    return c.json({ ok: true, type })
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500)
  }
})

export default router
