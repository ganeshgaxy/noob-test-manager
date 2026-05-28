import { Hono } from 'hono'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { requireAuth } from '../middleware/auth.js'

const THEME_PATH = resolve(process.cwd(), 'noob-sdet.theme.json')

export interface ThemeTokens {
  name: string
  bgBase: string
  bgSurface: string
  bgPanel: string
  bgElevated: string
  borderSubtle: string
  borderDefault: string
  borderStrong: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accentDanger: string
  accentSuccess: string
  accentWarning: string
  fontSans: string
  fontMono: string
  radius: number
}

export const DARK_THEME: ThemeTokens = {
  name: 'Dark',
  bgBase: '#000000',
  bgSurface: '#0d0d0d',
  bgPanel: '#111111',
  bgElevated: '#141414',
  borderSubtle: '#1a1a1a',
  borderDefault: '#222222',
  borderStrong: '#333333',
  textPrimary: '#ededed',
  textSecondary: '#888888',
  textMuted: '#555555',
  accentDanger: '#e5484d',
  accentSuccess: '#1a9e5e',
  accentWarning: '#b45309',
  fontSans: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "Cascadia Code", monospace',
  radius: 8,
}

async function readTheme(): Promise<ThemeTokens> {
  try {
    const raw = await readFile(THEME_PATH, 'utf-8')
    return { ...DARK_THEME, ...JSON.parse(raw) }
  } catch {
    return { ...DARK_THEME }
  }
}

async function writeTheme(theme: ThemeTokens): Promise<void> {
  await writeFile(THEME_PATH, JSON.stringify(theme, null, 2), 'utf-8')
}

export const themeRouter = new Hono()

// GET /api/theme — returns current theme (public, no auth, so the login page can also load it)
themeRouter.get('/', async (c) => {
  const theme = await readTheme()
  return c.json(theme)
})

// PUT /api/theme — saves theme (requires auth)
themeRouter.put('/', requireAuth, async (c) => {
  const body = await c.req.json<Partial<ThemeTokens>>()
  const current = await readTheme()
  const merged: ThemeTokens = { ...current, ...body }
  await writeTheme(merged)
  return c.json(merged)
})

// POST /api/theme/reset — resets to default dark theme
themeRouter.post('/reset', requireAuth, async (c) => {
  await writeTheme({ ...DARK_THEME })
  return c.json({ ...DARK_THEME })
})
