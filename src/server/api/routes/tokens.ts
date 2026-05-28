import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { apiTokens } from '../../db/schema.js'
import { requireAuth, getUser } from '../middleware/auth.js'
import { generateToken, hashToken } from '../../auth/crypto.js'

const router = new Hono()

// ─── GET /api/tokens — list own API tokens (secrets never returned) ───────────

router.get('/', requireAuth, async (c) => {
  const user = getUser(c)
  const tokens = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, user.id))
  return c.json(tokens)
})

// ─── POST /api/tokens — create an API token (secret shown ONCE) ──────────────

router.post('/', requireAuth, async (c) => {
  const user = getUser(c)
  const body = await c.req.json<{ name: string; expiresAt?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)

  const raw = `nbst_${generateToken(32)}`
  const tokenHash = hashToken(raw)

  const [created] = await db
    .insert(apiTokens)
    .values({
      userId: user.id,
      name: body.name.trim(),
      tokenHash,
      expiresAt: body.expiresAt ?? null,
    })
    .returning({
      id: apiTokens.id,
      name: apiTokens.name,
      expiresAt: apiTokens.expiresAt,
      createdAt: apiTokens.createdAt,
    })

  // Return the raw token exactly once — it cannot be recovered after this
  return c.json({ ...created, token: raw }, 201)
})

// ─── DELETE /api/tokens/:id — revoke a token ─────────────────────────────────

router.delete('/:id', requireAuth, async (c) => {
  const user = getUser(c)
  const id = Number(c.req.param('id'))

  const [deleted] = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id)))
    .returning()

  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.json({ success: true })
})

export { router as tokensRouter }
