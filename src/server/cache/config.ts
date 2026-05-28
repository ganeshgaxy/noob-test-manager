import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve } from 'path'

export type CacheType = 'none' | 'lru' | 'redis'

export interface CacheConfig {
  type: CacheType
  /** LRU: max number of entries (default 500) */
  lruMax?: number
  /** Redis: connection URL (default redis://localhost:6379) */
  redisUrl?: string
  /** TTL in seconds for cached entries (default 30) */
  ttl?: number
}

const CONFIG_PATH = resolve(process.cwd(), 'noob-sdet.config.json')

export function defaultCacheConfig(): CacheConfig {
  return { type: 'none', lruMax: 500, ttl: 30 }
}

/** Returns the active cache config from noob-sdet.config.json, falling back to defaults. */
export async function readCacheConfig(): Promise<CacheConfig> {
  if (!existsSync(CONFIG_PATH)) return defaultCacheConfig()
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const cfg = parsed.cache as CacheConfig | undefined
    if (cfg?.type) return { ...defaultCacheConfig(), ...cfg }
  } catch {
    // fall through
  }
  return defaultCacheConfig()
}

/** Persists the cache config to noob-sdet.config.json (merges with existing keys). */
export async function writeCacheConfig(config: CacheConfig): Promise<void> {
  let existing: Record<string, unknown> = {}
  if (existsSync(CONFIG_PATH)) {
    try {
      existing = JSON.parse(await readFile(CONFIG_PATH, 'utf-8')) as Record<string, unknown>
    } catch {
      // ignore — overwrite
    }
  }
  await writeFile(CONFIG_PATH, JSON.stringify({ ...existing, cache: config }, null, 2), 'utf-8')
}
