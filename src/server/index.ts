import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { readFile } from 'fs/promises'
import { resolve, join } from 'path'
import { existsSync } from 'fs'
import { initDb, db } from './db/client.js'
import { initCache } from './cache/client.js'
import { users } from './db/schema.js'
import {
  appsRouter,
  spacesRouter,
  foldersRouter,
  testsRouter,
  runsRouter,
  bulkRouter,
  trashRouter,
  fieldsRouter,
  appSettingsRouter,
  integrationsRouter,
  dbConfigRouter,
  cacheConfigRouter,
  authRouter,
  usersRouter,
  tokensRouter,
  membersRouter,
  authConfigRouter,
  groupsRouter,
  ssoRouter,
  themeRouter,
  testmuRouter,
  tagsRouter,
} from './api/routes/index.js'

const app = new Hono()

app.use('*', logger())
app.use('/api/*', cors())

// Global error handler — converts thrown errors with a `.status` property into proper HTTP responses
app.onError((err, c) => {
  const status = (err as { status?: number }).status
  if (status === 403) return c.json({ error: 'forbidden' }, 403)
  if (status === 404) return c.json({ error: 'not found' }, 404)
  if (status === 401) return c.json({ error: 'authentication required' }, 401)
  console.error('[server error]', err)
  return c.json({ error: err.message || 'internal server error' }, 500)
})

app.route('/api/apps', appsRouter)
app.route('/api/apps/:appId/spaces', spacesRouter)
app.route('/api/spaces/:spaceId/folders', foldersRouter)
app.route('/api/folders/:folderId/tests', testsRouter)
app.route('/api/apps/:appId/runs', runsRouter)
app.route('/api/apps/:appId/fields', fieldsRouter)
app.route('/api/apps/:appId/app-settings', appSettingsRouter)
app.route('/api/apps/:appId/integrations', integrationsRouter)
app.route('/api/bulk', bulkRouter)
app.route('/api/spaces/:spaceId/trash', trashRouter)
app.route('/api/db-config', dbConfigRouter)
app.route('/api/cache-config', cacheConfigRouter)
app.route('/api/auth', authRouter)
app.route('/api/users', usersRouter)
app.route('/api/tokens', tokensRouter)
app.route('/api', membersRouter)
app.route('/api/auth-config', authConfigRouter)
app.route('/api/groups', groupsRouter)
app.route('/api/auth/sso', ssoRouter)
app.route('/api/theme', themeRouter)
app.route('/api/testmu', testmuRouter)
app.route('/api/apps/:appId/tags', tagsRouter)

/** Create a default super_admin if the users table is empty (first-run bootstrap). */
async function seedInitialAdmin(): Promise<void> {
  const existing = await db.select({ id: users.id }).from(users).limit(1)
  if (existing.length > 0) return

  const bcrypt = (await import('bcryptjs')).default
  const DEFAULT_EMAIL = 'admin@noob-sdet.local'
  const DEFAULT_PASSWORD = 'Admin1234!'
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12)

  await db.insert(users).values({
    email: DEFAULT_EMAIL,
    name: 'Admin',
    passwordHash,
    globalRole: 'super_admin',
  })

  console.log('\n  ┌─────────────────────────────────────────────┐')
  console.log('  │        🔑  First-run admin account          │')
  console.log('  │                                             │')
  console.log(`  │  Email   : ${DEFAULT_EMAIL}                 │`)
  console.log(`  │  Password: ${DEFAULT_PASSWORD}              │`)
  console.log('  │                                             │')
  console.log('  │  Change your password after first login!    │')
  console.log('  └─────────────────────────────────────────────┘\n')
}

export async function startServer(port = 3000, clientDir: string) {
  await initDb()
  await seedInitialAdmin()
  await initCache()

  // Serve static assets from the pre-built client directory
  app.use('/*', async (c, next) => {
    const urlPath = c.req.path === '/' ? '/index.html' : c.req.path
    const filePath = join(clientDir, urlPath)

    if (existsSync(filePath)) {
      const ext = filePath.split('.').pop() ?? ''
      const mimeTypes: Record<string, string> = {
        html: 'text/html',
        js: 'application/javascript',
        css: 'text/css',
        png: 'image/png',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        json: 'application/json',
      }
      const content = await readFile(filePath)
      return c.body(content as unknown as string, 200, {
        'Content-Type': mimeTypes[ext] ?? 'application/octet-stream',
      })
    }

    await next()
  })

  // SPA fallback — always serve index.html for unknown routes
  app.get('/*', async (c) => {
    const html = await readFile(resolve(clientDir, 'index.html'), 'utf-8')
    return c.html(html)
  })

  return new Promise<void>((resolvePromise) => {
    serve({ fetch: app.fetch, port }, () => {
      resolvePromise()
    })
  })
}

export default app
