import { Hono } from 'hono'
import { readAuthConfig, writeAuthConfig, type AuthConfig } from '../../auth/config.js'
import { testEmailConnection } from '../../auth/email.js'
import { requireAuth, requireSuperAdmin, getUser } from '../middleware/auth.js'

const router = new Hono()

// ─── GET /api/auth-config ─────────────────────────────────────────────────────

router.get('/', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const cfg = await readAuthConfig()
  // Mask sensitive fields before returning
  let response: Record<string, unknown> = { ...cfg }

  if (cfg.passwordReset.type === 'email') {
    const provider = cfg.passwordReset.emailProvider
    const masked = { ...provider } as Record<string, unknown>
    if (masked.pass) masked.pass = '••••••••'
    if (masked.apiKey) masked.apiKey = '••••••••'
    response = { ...response, passwordReset: { ...cfg.passwordReset, emailProvider: masked } }
  }

  if (cfg.sso?.clientSecret) {
    response = { ...response, sso: { ...cfg.sso, clientSecret: '••••••••' } }
  }

  return c.json(response)
})

// ─── PUT /api/auth-config ─────────────────────────────────────────────────────

router.put('/', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const body = await c.req.json<AuthConfig>()
  if (!body.passwordReset?.type) return c.json({ error: 'passwordReset.type is required' }, 400)

  // If email mode, validate required provider fields
  if (body.passwordReset.type === 'email') {
    const p = body.passwordReset.emailProvider
    if (!p) return c.json({ error: 'emailProvider config is required in email mode' }, 400)
    if (!p.from) return c.json({ error: 'emailProvider.from is required' }, 400)
    if (p.type === 'smtp') {
      if (!p.host || !p.port) return c.json({ error: 'smtp host and port are required' }, 400)
    } else if (p.type === 'resend' || p.type === 'sendgrid') {
      if (!p.apiKey) return c.json({ error: `${p.type} apiKey is required` }, 400)
    }
  }

  // Merge with existing config to preserve masked secrets that weren't re-submitted
  const existing = await readAuthConfig()
  let merged = body

  if (
    body.passwordReset.type === 'email' &&
    existing.passwordReset.type === 'email' &&
    body.passwordReset.emailProvider.type === existing.passwordReset.emailProvider.type
  ) {
    const existingProvider = existing.passwordReset.emailProvider
    const newProvider = body.passwordReset.emailProvider

    // If the client submitted masked values, restore originals
    const restored: Record<string, unknown> = { ...existingProvider, ...newProvider }
    if ('pass' in newProvider && (newProvider as Record<string, unknown>).pass === '••••••••') {
      restored.pass = (existingProvider as Record<string, unknown>).pass
    }
    if ('apiKey' in newProvider && (newProvider as Record<string, unknown>).apiKey === '••••••••') {
      restored.apiKey = (existingProvider as Record<string, unknown>).apiKey
    }

    merged = {
      ...body,
      passwordReset: {
        type: 'email',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        emailProvider: restored as any,
      },
    }
  }

  // Restore masked SSO client secret
  if (
    body.sso?.clientSecret === '••••••••' &&
    existing.sso?.clientSecret &&
    existing.sso.type === body.sso?.type
  ) {
    merged = {
      ...merged,
      sso: { ...merged.sso, clientSecret: existing.sso.clientSecret },
    } as typeof merged
  }

  await writeAuthConfig(merged)
  return c.json({ ok: true })
})

// ─── POST /api/auth-config/test-email ────────────────────────────────────────

router.post('/test-email', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const user = getUser(c)
  const body = await c.req.json<AuthConfig>()

  if (body.passwordReset.type !== 'email') {
    return c.json({ error: 'not in email mode' }, 400)
  }

  const result = await testEmailConnection(body.passwordReset.emailProvider, user.email)
  if (!result.ok) return c.json({ ok: false, error: result.error }, 422)
  return c.json({ ok: true, sentTo: user.email })
})

export { router as authConfigRouter }
