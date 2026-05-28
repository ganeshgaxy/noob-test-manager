import { Hono } from 'hono'
import { readCacheConfig, writeCacheConfig, type CacheConfig } from '../../cache/config.js'
import { initCache, currentCacheConfig } from '../../cache/client.js'

const router = new Hono()

// GET /api/cache-config — return current cache settings
router.get('/', async (c) => {
  const cfg = await readCacheConfig()
  return c.json({
    type: currentCacheConfig.type,
    lruMax: cfg.lruMax ?? 500,
    redisUrl: cfg.redisUrl ?? '',
    ttl: cfg.ttl ?? 30,
    active: currentCacheConfig.type,
  })
})

// POST /api/cache-config/test — probe without saving
router.post('/test', async (c) => {
  const body = await c.req.json<{ type: string; redisUrl?: string }>()

  if (body.type === 'none' || body.type === 'lru') {
    return c.json({
      ok: true,
      message: body.type === 'none' ? 'Caching disabled.' : 'LRU cache ready (in-process).',
    })
  }

  if (body.type === 'redis') {
    const url = body.redisUrl?.trim() || 'redis://localhost:6379'
    try {
      const { default: Redis } = await import('ioredis')
      const client = new Redis(url, {
        maxRetriesPerRequest: 1,
        connectTimeout: 4000,
        lazyConnect: true,
      })
      await client.connect()
      await client.ping()
      await client.quit()
      return c.json({ ok: true, message: `Connected to Redis at ${url}` })
    } catch (err) {
      return c.json({ ok: false, error: (err as Error).message })
    }
  }

  return c.json({ ok: false, error: 'Unknown cache type.' }, 400)
})

// PUT /api/cache-config — save and hot-swap
router.put('/', async (c) => {
  const body = await c.req.json<{
    type: string
    lruMax?: number
    redisUrl?: string
    ttl?: number
  }>()

  const allowed = ['none', 'lru', 'redis']
  if (!allowed.includes(body.type)) {
    return c.json({ ok: false, error: 'Invalid cache type.' }, 400)
  }

  const config: CacheConfig = {
    type: body.type as CacheConfig['type'],
    lruMax: Number(body.lruMax) || 500,
    redisUrl: body.redisUrl?.trim() || undefined,
    ttl: Number(body.ttl) || 30,
  }

  try {
    await initCache(config)
    await writeCacheConfig(config)
    return c.json({ ok: true, type: config.type, message: `Cache switched to ${config.type}.` })
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 500)
  }
})

export default router
