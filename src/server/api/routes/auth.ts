import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users, sessions } from '../../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { readAuthConfig } from '../../auth/config.js'
import {
  generateToken,
  hashToken,
  daysFromNow,
  minutesFromNow,
  isExpired,
} from '../../auth/crypto.js'
import { makeEmailSender, buildPasswordResetEmail } from '../../auth/email.js'
import { passwordResetTokens } from '../../db/schema.js'

const router = new Hono()

// Lazily imported bcryptjs — use .default because bcryptjs is CJS; esbuild
// wraps it as { default: module } when bundled into ESM.
async function bcrypt() {
  return (await import('bcryptjs')).default
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>()
  if (!body.email || !body.password) return c.json({ error: 'email and password required' }, 400)

  const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase()))
  if (!user) return c.json({ error: 'invalid credentials' }, 401)
  if (!user.isActive) return c.json({ error: 'account disabled' }, 403)

  const b = await bcrypt()
  const valid = await b.compare(body.password, user.passwordHash)
  if (!valid) return c.json({ error: 'invalid credentials' }, 401)

  const cfg = await readAuthConfig()
  const sessionId = generateToken(32)
  const expiresAt = daysFromNow(cfg.sessionDays ?? 7)

  await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt })

  setCookie(c, 'sid', sessionId, {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
    expires: new Date(expiresAt),
    // secure: true — enable in production behind HTTPS
  })

  const { passwordHash: _passwordHash, ...safeUser } = user
  return c.json({ user: safeUser, mustChangePassword: user.mustChangePassword })
})

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post('/logout', async (c) => {
  const sid = getCookie(c, 'sid')
  if (sid) {
    await db.delete(sessions).where(eq(sessions.id, sid))
  }
  deleteCookie(c, 'sid', { path: '/' })
  return c.json({ ok: true })
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (c) => {
  const user = c.get('user' as never) as typeof users.$inferSelect
  const { passwordHash: _passwordHash, ...safeUser } = user
  return c.json(safeUser)
})

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

router.post('/forgot-password', async (c) => {
  const cfg = await readAuthConfig()
  if (cfg.passwordReset.type !== 'email') {
    return c.json({ error: 'email-based password reset is not enabled' }, 400)
  }

  const body = await c.req.json<{ email: string }>()
  if (!body.email) return c.json({ error: 'email required' }, 400)

  const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase()))
  // Always return success to prevent user enumeration
  if (!user || !user.isActive) return c.json({ ok: true })

  // Invalidate any previous reset tokens for this user
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id))

  const token = generateToken(32)
  const tokenHash = hashToken(token)
  const expiresAt = minutesFromNow(60)

  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt })

  const resetUrl = `${c.req.url.replace('/api/auth/forgot-password', '')}/reset-password?token=${token}`
  const html = buildPasswordResetEmail(resetUrl, 60)

  const sender = await makeEmailSender(cfg.passwordReset.emailProvider)
  await sender.send(user.email, 'Reset your noob-sdet password', html)

  return c.json({ ok: true })
})

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

router.post('/reset-password', async (c) => {
  const body = await c.req.json<{ token: string; password: string }>()
  if (!body.token || !body.password) return c.json({ error: 'token and password required' }, 400)
  if (body.password.length < 8)
    return c.json({ error: 'password must be at least 8 characters' }, 400)

  const tokenHash = hashToken(body.token)
  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))

  if (!resetToken) return c.json({ error: 'invalid or expired token' }, 400)
  if (resetToken.usedAt) return c.json({ error: 'token already used' }, 400)
  if (isExpired(resetToken.expiresAt)) return c.json({ error: 'token expired' }, 400)

  const b = await bcrypt()
  const passwordHash = await b.hash(body.password, 12)

  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false, updatedAt: new Date().toISOString() })
    .where(eq(users.id, resetToken.userId))

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(passwordResetTokens.id, resetToken.id))

  // Invalidate all active sessions for this user
  await db.delete(sessions).where(eq(sessions.userId, resetToken.userId))

  return c.json({ ok: true })
})

export { router as authRouter }
