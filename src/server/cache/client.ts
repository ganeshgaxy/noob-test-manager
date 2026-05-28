import { LRUCache } from 'lru-cache'
import { readCacheConfig, type CacheConfig } from './config.js'

/** Unified cache interface — same API regardless of backend. */
export interface Cache {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  del(...keys: string[]): Promise<void>
  flush(): Promise<void>
  type: CacheConfig['type']
}

// ── None cache (no-op) ─────────────────────────────────────────────────────

const noneCache: Cache = {
  type: 'none',
  get: async () => null,
  set: async () => {},
  del: async () => {},
  flush: async () => {},
}

// ── LRU cache factory ──────────────────────────────────────────────────────

function makeLruCache(max: number, defaultTtlSeconds: number): Cache {
  const lru = new LRUCache<string, unknown>({
    max,
    ttl: defaultTtlSeconds * 1000, // lru-cache uses milliseconds
  })
  return {
    type: 'lru',
    get: async <T>(key: string) => (lru.get(key) as T) ?? null,
    set: async <T>(key: string, value: T, ttlSeconds?: number) => {
      lru.set(key, value, ttlSeconds ? { ttl: ttlSeconds * 1000 } : undefined)
    },
    del: async (...keys: string[]) => {
      for (const k of keys) lru.delete(k)
    },
    flush: async () => lru.clear(),
  }
}

// ── Redis cache factory ────────────────────────────────────────────────────

async function makeRedisCache(url: string, defaultTtlSeconds: number): Promise<Cache> {
  // Dynamic import so the ioredis module is only loaded when Redis is actually selected
  const { default: Redis } = await import('ioredis')
  const redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  })
  await redis.connect()

  return {
    type: 'redis',
    get: async <T>(key: string) => {
      const raw = await redis.get(key)
      if (raw === null) return null
      return JSON.parse(raw) as T
    },
    set: async <T>(key: string, value: T, ttlSeconds?: number) => {
      const ttl = ttlSeconds ?? defaultTtlSeconds
      await redis.set(key, JSON.stringify(value), 'EX', ttl)
    },
    del: async (...keys: string[]) => {
      if (keys.length) await redis.del(...keys)
    },
    flush: async () => {
      await redis.flushdb()
    },
  }
}

// ── Active cache singleton ─────────────────────────────────────────────────

export let cache: Cache = noneCache
export let currentCacheConfig: CacheConfig = { type: 'none' }

/**
 * Initialises (or re-initialises) the cache layer.
 * Pass an explicit config to switch at runtime; omit to read from the config file.
 */
export async function initCache(config?: CacheConfig): Promise<void> {
  const resolved = config ?? (await readCacheConfig())
  currentCacheConfig = resolved

  const ttl = resolved.ttl ?? 30

  if (resolved.type === 'lru') {
    cache = makeLruCache(resolved.lruMax ?? 500, ttl)
    return
  }

  if (resolved.type === 'redis') {
    const url = resolved.redisUrl ?? 'redis://localhost:6379'
    cache = await makeRedisCache(url, ttl)
    return
  }

  cache = noneCache
}
