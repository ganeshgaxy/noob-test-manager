import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve } from 'path'

export type DbType = 'sqlite' | 'turso' | 'postgres'

export interface DbConfig {
  type: DbType
  url: string
  token?: string // Turso auth token
  poolMax?: number // PostgreSQL max pool connections (default 10)
}

const CONFIG_PATH = resolve(process.cwd(), 'noob-sdet.config.json')

function defaultConfig(): DbConfig {
  return {
    type: 'sqlite',
    url: `file:${resolve(process.cwd(), 'noob-sdet.db')}`,
  }
}

/** Returns the active DB config. Priority: env vars → config file → default (local SQLite). */
export async function readDbConfig(): Promise<DbConfig> {
  // Environment variables always win
  if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL
    const token = process.env.DATABASE_AUTH_TOKEN
    if (url.startsWith('libsql://') || url.startsWith('wss://')) {
      return { type: 'turso', url, ...(token ? { token } : {}) }
    }
    if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
      return { type: 'postgres', url }
    }
    return { type: 'sqlite', url }
  }

  if (!existsSync(CONFIG_PATH)) return defaultConfig()

  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const cfg = parsed.db as DbConfig | undefined
    if (cfg?.type && cfg?.url) return cfg
  } catch {
    // fall through
  }
  return defaultConfig()
}

/** Persists the DB config to noob-sdet.config.json (merges with any existing keys). */
export async function writeDbConfig(config: DbConfig): Promise<void> {
  let existing: Record<string, unknown> = {}
  if (existsSync(CONFIG_PATH)) {
    try {
      existing = JSON.parse(await readFile(CONFIG_PATH, 'utf-8')) as Record<string, unknown>
    } catch {
      // ignore parse errors — we'll overwrite
    }
  }
  await writeFile(CONFIG_PATH, JSON.stringify({ ...existing, db: config }, null, 2), 'utf-8')
}
