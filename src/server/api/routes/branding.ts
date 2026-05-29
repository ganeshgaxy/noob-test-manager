import { Hono } from 'hono'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js'

const BRANDING_PATH = resolve(process.cwd(), 'noob-sdet.config.json')

export interface BrandingConfig {
  appTitle: string
  /** Base64 data URI of the app icon (SVG or PNG). Null = no custom icon. */
  iconData: string | null
}

const DEFAULT_BRANDING: BrandingConfig = {
  appTitle: 'noob-sdet',
  iconData: null,
}

async function readBranding(): Promise<BrandingConfig> {
  try {
    const raw = await readFile(BRANDING_PATH, 'utf-8')
    return { ...DEFAULT_BRANDING, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_BRANDING }
  }
}

async function writeBranding(b: BrandingConfig): Promise<void> {
  // Merge with existing file so other keys (db, cache, etc.) are preserved
  let existing: Record<string, unknown> = {}
  try {
    const raw = await readFile(BRANDING_PATH, 'utf-8')
    existing = JSON.parse(raw) as Record<string, unknown>
  } catch {
    // file missing or unparseable — start fresh
  }
  await writeFile(
    BRANDING_PATH,
    JSON.stringify({ ...existing, appTitle: b.appTitle, iconData: b.iconData }, null, 2),
    'utf-8'
  )
}

export const brandingRouter = new Hono()

// GET /api/branding — public (login page needs it before auth)
brandingRouter.get('/', async (c) => {
  return c.json(await readBranding())
})

// PUT /api/branding — update (super_admin only — affects all users)
brandingRouter.put('/', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const body = await c.req.json<Partial<BrandingConfig>>()
  const current = await readBranding()

  // Validate iconData — must be a data URI of SVG or PNG, max ~512 KB
  const iconData = 'iconData' in body ? body.iconData : current.iconData
  if (iconData !== null && iconData !== undefined) {
    if (!/^data:image\/(svg\+xml|png);base64,/.test(iconData)) {
      return c.json({ error: 'iconData must be a base64 PNG or SVG data URI' }, 400)
    }
    if (iconData.length > 700_000) {
      return c.json({ error: 'Icon too large (max ~512 KB)' }, 400)
    }
  }

  const next: BrandingConfig = {
    appTitle: (body.appTitle ?? current.appTitle).trim() || DEFAULT_BRANDING.appTitle,
    iconData: iconData ?? null,
  }
  await writeBranding(next)
  return c.json(next)
})

// POST /api/branding/reset (super_admin only)
brandingRouter.post('/reset', requireAuth, async (c) => {
  requireSuperAdmin(c)
  await writeBranding({ ...DEFAULT_BRANDING })
  return c.json({ ...DEFAULT_BRANDING })
})
