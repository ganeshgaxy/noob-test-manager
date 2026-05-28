import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users, sessions } from '../../db/schema.js'
import { requireSuperAdmin, requireAuth, getUser } from '../middleware/auth.js'
import { generateToken } from '../../auth/crypto.js'

const router = new Hono()

// Lazily imported bcryptjs — use .default because bcryptjs is CJS; esbuild
// wraps it as { default: module } when bundled into ESM.
async function bcrypt() {
  return (await import('bcryptjs')).default
}

// ─── GET /api/users — list all users (super_admin only) ──────────────────────

router.get('/', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const all = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      globalRole: users.globalRole,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
  return c.json(all)
})

// ─── POST /api/users — create user (super_admin only) ────────────────────────

router.post('/', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const body = await c.req.json<{
    email: string
    name: string
    password: string
    globalRole?: 'super_admin' | 'member'
  }>()
  if (!body.email || !body.name || !body.password)
    return c.json({ error: 'email, name and password required' }, 400)
  if (body.password.length < 8)
    return c.json({ error: 'password must be at least 8 characters' }, 400)

  const b = await bcrypt()
  const passwordHash = await b.hash(body.password, 12)

  try {
    const [user] = await db
      .insert(users)
      .values({
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash,
        globalRole: body.globalRole ?? 'member',
      })
      .returning()
    const { passwordHash: _passwordHash, ...safe } = user
    return c.json(safe, 201)
  } catch {
    return c.json({ error: 'email already in use' }, 409)
  }
})

// ─── GET /api/users/search?q= — search users by email/name (any authenticated user) ──

router.get('/search', requireAuth, async (c) => {
  const q = (c.req.query('q') ?? '').toLowerCase().trim()
  if (!q || q.length < 2) return c.json([])

  const all = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.isActive, true))

  const results = all
    .filter((u) => u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q))
    .slice(0, 10)

  return c.json(results)
})

// ─── GET /api/users/:id ───────────────────────────────────────────────────────

router.get('/:id', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const id = Number(c.req.param('id'))
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      globalRole: users.globalRole,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, id))
  if (!user) return c.json({ error: 'not found' }, 404)
  return c.json(user)
})

// ─── PUT /api/users/:id — update user (super_admin only) ─────────────────────

router.put('/:id', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{
    name?: string
    globalRole?: 'super_admin' | 'member'
    isActive?: boolean
  }>()

  const [updated] = await db
    .update(users)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(users.id, id))
    .returning()
  if (!updated) return c.json({ error: 'not found' }, 404)
  const { passwordHash: _passwordHash, ...safe } = updated
  return c.json(safe)
})

// ─── POST /api/users/:id/reset-password — admin reset (super_admin only) ─────

router.post('/:id/reset-password', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const id = Number(c.req.param('id'))

  // Generate a temporary password and show it once
  const tempPassword = generateToken(6) // 12 hex chars
  const b = await bcrypt()
  const passwordHash = await b.hash(tempPassword, 12)

  const [updated] = await db
    .update(users)
    .set({ passwordHash, mustChangePassword: true, updatedAt: new Date().toISOString() })
    .where(eq(users.id, id))
    .returning()

  if (!updated) return c.json({ error: 'not found' }, 404)

  // Invalidate all existing sessions for this user
  await db.delete(sessions).where(eq(sessions.userId, id))

  return c.json({ tempPassword })
})

// ─── DELETE /api/users/:id — delete user (super_admin only) ──────────────────

router.delete('/:id', requireAuth, async (c) => {
  requireSuperAdmin(c)
  const currentUser = getUser(c)
  const id = Number(c.req.param('id'))
  if (currentUser.id === id) return c.json({ error: 'cannot delete yourself' }, 400)

  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning()
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

// ─── GET /api/users/me — current user profile ────────────────────────────────

router.get('/me', requireAuth, async (c) => {
  const user = getUser(c)
  const { passwordHash: _passwordHash, ...safe } = user
  return c.json(safe)
})

// ─── PUT /api/users/me — update own profile ───────────────────────────────────

router.put('/me', requireAuth, async (c) => {
  const user = getUser(c)
  const body = await c.req.json<{ name?: string; currentPassword?: string; newPassword?: string }>()

  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date().toISOString() }
  if (body.name) updates.name = body.name

  if (body.newPassword) {
    if (!body.currentPassword) return c.json({ error: 'currentPassword required' }, 400)
    if (body.newPassword.length < 8)
      return c.json({ error: 'password must be at least 8 characters' }, 400)
    const b = await bcrypt()
    const valid = await b.compare(body.currentPassword, user.passwordHash)
    if (!valid) return c.json({ error: 'current password is incorrect' }, 400)
    updates.passwordHash = await b.hash(body.newPassword, 12)
    updates.mustChangePassword = false
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, user.id)).returning()
  const { passwordHash: _passwordHash, ...safe } = updated
  return c.json(safe)
})

export { router as usersRouter }
