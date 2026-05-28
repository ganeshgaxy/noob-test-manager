import { useState, useEffect, type FormEvent } from 'react'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Label } from '../ui/label.js'
import { useAuth } from '../../contexts/AuthContext.js'
import { api } from '../../lib/api.js'

// ─── Shared card shell ────────────────────────────────────────────────────────

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--t-bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 380,
          background: 'var(--t-bg-surface)',
          border: '1px solid var(--t-border-subtle)',
          borderRadius: 12,
          padding: '36px 32px',
        }}
      >
        {/* Logo / wordmark */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--t-text-primary)',
            }}
          >
            noob<span style={{ color: 'var(--t-text-secondary)' }}>-sdet</span>
          </span>
        </div>

        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--t-text-primary)',
            marginBottom: 6,
            textAlign: 'center',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--t-text-muted)',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: 'rgba(229,72,77,0.1)',
        border: '1px solid rgba(229,72,77,0.3)',
        borderRadius: 6,
        padding: '10px 14px',
        color: 'var(--t-accent-danger)',
        fontSize: 13,
        marginBottom: 16,
      }}
    >
      {message}
    </div>
  )
}

// ─── SSO error messages ───────────────────────────────────────────────────────

const SSO_ERRORS: Record<string, string> = {
  invalid_state: 'SSO authentication failed — please try again.',
  missing_code: 'SSO provider did not return an authorization code.',
  account_not_found: 'No account found for this SSO identity. Contact your admin.',
  account_disabled: 'Your account is disabled. Contact your admin.',
  callback_failed: 'SSO sign-in failed — check your provider configuration.',
  sso_not_configured: 'SSO is not configured on this server.',
}

// ─── LoginView ────────────────────────────────────────────────────────────────

export function LoginView() {
  const { login, setAuthScreen } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sso, setSso] = useState<{ enabled: boolean; provider: 'oidc' | 'github' | null } | null>(
    null
  )

  useEffect(() => {
    void api.sso
      .config()
      .then(setSso)
      .catch(() => {})
    const params = new URLSearchParams(window.location.search)
    const ssoError = params.get('sso_error')
    if (ssoError) {
      setError(SSO_ERRORS[ssoError] ?? `SSO error: ${ssoError}`)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Sign in to your workspace">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <ErrorBanner message={error} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="email" style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="password" style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <Button type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>

        <button
          type="button"
          onClick={() => setAuthScreen('forgot-password')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--t-text-muted)',
            fontSize: 12,
            cursor: 'pointer',
            textAlign: 'center',
            padding: 0,
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.color = 'var(--t-text-primary)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.color = 'var(--t-text-muted)')
          }
        >
          Forgot password?
        </button>

        {sso?.enabled && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--t-border-subtle)' }} />
              <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--t-border-subtle)' }} />
            </div>
            <a
              href="/api/auth/sso/redirect"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid var(--t-border-default)',
                background: 'var(--t-bg-panel)',
                color: 'var(--t-text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-strong)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-primary)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-default)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
              }}
            >
              {sso.provider === 'github' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
              )}
              {sso.provider === 'github' ? 'Sign in with GitHub' : 'Sign in with SSO'}
            </a>
          </>
        )}
      </form>
    </AuthCard>
  )
}
