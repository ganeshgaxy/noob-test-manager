import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { eq, and } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { db } from '../../db/client.js'
import { users, sessions } from '../../db/schema.js'
import { readAuthConfig, type OidcSsoConfig } from '../../auth/config.js'
import { generateToken, daysFromNow } from '../../auth/crypto.js'

const router = new Hono()

function getBaseUrl(c: { req: { url: string } }): string {
  const url = new URL(c.req.url)
  return `${url.protocol}//${url.host}`
}

// ─── GET /api/auth/sso/config (public — no auth required) ─────────────────────
// Returns whether SSO is configured so the login page can show the SSO button.
router.get('/config', async (c) => {
  const cfg = await readAuthConfig()
  if (!cfg.sso?.clientId || !cfg.sso?.clientSecret) {
    return c.json({ enabled: false, provider: null })
  }
  return c.json({ enabled: true, provider: cfg.sso.type })
})

// ─── GET /api/auth/sso/redirect ───────────────────────────────────────────────
// Redirects the browser to the SSO provider's authorization URL.
router.get('/redirect', async (c) => {
  const cfg = await readAuthConfig()
  if (!cfg.sso?.clientId || !cfg.sso?.clientSecret) {
    return c.json({ error: 'SSO not configured' }, 400)
  }

  const state = randomBytes(16).toString('hex')
  setCookie(c, 'oauth_state', state, { httpOnly: true, path: '/', maxAge: 600 })

  const redirectUri = `${getBaseUrl(c)}/api/auth/sso/callback`
  let authUrl: string

  if (cfg.sso.type === 'github') {
    const params = new URLSearchParams({
      client_id: cfg.sso.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
    })
    authUrl = `https://github.com/login/oauth/authorize?${params}`
  } else {
    const discovery = await fetchOidcDiscovery(cfg.sso.discoveryUrl)
    const params = new URLSearchParams({
      client_id: cfg.sso.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    })
    authUrl = `${discovery.authorization_endpoint}?${params}`
  }

  return c.redirect(authUrl)
})

// ─── GET /api/auth/sso/callback ───────────────────────────────────────────────
// OAuth callback: verify state, exchange code, find/create user, create session.
router.get('/callback', async (c) => {
  const { code, state, error } = c.req.query()
  if (error) return c.redirect(`/?sso_error=${encodeURIComponent(String(error))}`)

  const savedState = getCookie(c, 'oauth_state')
  deleteCookie(c, 'oauth_state', { path: '/' })
  if (!state || !savedState || state !== savedState) return c.redirect('/?sso_error=invalid_state')
  if (!code) return c.redirect('/?sso_error=missing_code')

  const cfg = await readAuthConfig()
  if (!cfg.sso?.clientId || !cfg.sso?.clientSecret)
    return c.redirect('/?sso_error=sso_not_configured')

  const redirectUri = `${getBaseUrl(c)}/api/auth/sso/callback`

  try {
    let subject: string, email: string, name: string
    const provider = cfg.sso.type

    if (provider === 'github') {
      ;({ subject, email, name } = await exchangeGitHubCode(
        code,
        cfg.sso.clientId,
        cfg.sso.clientSecret,
        redirectUri
      ))
    } else {
      ;({ subject, email, name } = await exchangeOidcCode(
        code,
        cfg.sso as OidcSsoConfig,
        redirectUri
      ))
    }

    // Find user by SSO identity
    let [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.ssoProvider, provider), eq(users.ssoSubject, subject)))

    if (!user) {
      // Try to link to an existing account with the same email
      const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase()))
      if (existing) {
        const [updated] = await db
          .update(users)
          .set({ ssoProvider: provider, ssoSubject: subject })
          .where(eq(users.id, existing.id))
          .returning()
        user = updated
      } else if (cfg.sso.autoProvision !== false) {
        // Auto-provision a new user
        const placeholder = `sso_placeholder_${randomBytes(16).toString('hex')}`
        const [created] = await db
          .insert(users)
          .values({
            email: email.toLowerCase(),
            name: name || email.split('@')[0],
            passwordHash: placeholder,
            ssoProvider: provider,
            ssoSubject: subject,
            globalRole: 'member',
          })
          .returning()
        user = created
      } else {
        return c.redirect('/?sso_error=account_not_found')
      }
    }

    if (!user.isActive) return c.redirect('/?sso_error=account_disabled')

    const sessionId = generateToken(32)
    const expiresAt = daysFromNow(cfg.sessionDays ?? 7)
    await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt })
    setCookie(c, 'sid', sessionId, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      expires: new Date(expiresAt),
    })

    return c.redirect('/')
  } catch (err) {
    console.error('[SSO callback error]', err)
    return c.redirect('/?sso_error=callback_failed')
  }
})

// ─── OIDC helpers ─────────────────────────────────────────────────────────────

interface OidcDiscovery {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
}

async function fetchOidcDiscovery(issuerUrl: string): Promise<OidcDiscovery> {
  const url = issuerUrl.replace(/\/$/, '') + '/.well-known/openid-configuration'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`)
  return res.json() as Promise<OidcDiscovery>
}

async function exchangeOidcCode(
  code: string,
  sso: OidcSsoConfig,
  redirectUri: string
): Promise<{ subject: string; email: string; name: string }> {
  const discovery = await fetchOidcDiscovery(sso.discoveryUrl)
  const tokenRes = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: sso.clientId,
      client_secret: sso.clientSecret,
    }),
  })
  if (!tokenRes.ok) throw new Error(`OIDC token exchange failed: ${tokenRes.status}`)
  const tokens = (await tokenRes.json()) as { access_token: string }
  const userRes = await fetch(discovery.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!userRes.ok) throw new Error(`OIDC userinfo failed: ${userRes.status}`)
  const info = (await userRes.json()) as {
    sub: string
    email: string
    name?: string
    given_name?: string
  }
  return { subject: info.sub, email: info.email, name: info.name ?? info.given_name ?? info.email }
}

// ─── GitHub OAuth helpers ─────────────────────────────────────────────────────

async function exchangeGitHubCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ subject: string; email: string; name: string }> {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!tokenRes.ok) throw new Error(`GitHub token exchange failed: ${tokenRes.status}`)
  const tokenData = (await tokenRes.json()) as { access_token: string; error?: string }
  if (tokenData.error) throw new Error(`GitHub OAuth error: ${tokenData.error}`)

  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'noob-sdet' },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'noob-sdet' },
    }),
  ])
  if (!userRes.ok) throw new Error(`GitHub user fetch failed: ${userRes.status}`)
  const ghUser = (await userRes.json()) as {
    id: number
    login: string
    name?: string
    email?: string
  }

  let email = ghUser.email ?? ''
  if (!email && emailsRes.ok) {
    const emails = (await emailsRes.json()) as Array<{
      email: string
      primary: boolean
      verified: boolean
    }>
    const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified)
    if (primary) email = primary.email
  }
  if (!email) throw new Error('No verified email found in GitHub account')
  return { subject: String(ghUser.id), email, name: ghUser.name ?? ghUser.login }
}

export { router as ssoRouter }
