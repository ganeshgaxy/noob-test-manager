import { useState, type FormEvent } from 'react'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Label } from '../ui/label.js'
import { AuthCard } from './LoginView.js'
import { useAuth } from '../../contexts/AuthContext.js'
import { api } from '../../lib/api.js'

export function ForgotPasswordView() {
  const { setAuthScreen } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await api.auth.forgotPassword(email)
      // admin-only mode returns a temp password directly
      if (result.tempPassword) setTempPassword(result.tempPassword)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <AuthCard
        title="Check your inbox"
        subtitle={
          tempPassword
            ? 'Your admin has generated a temporary password.'
            : `A reset link has been sent to ${email}`
        }
      >
        {tempPassword && (
          <div
            style={{
              background: '#141414',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
              Temporary password (shown once)
            </p>
            <code
              style={{ fontSize: 18, fontWeight: 700, color: '#ededed', letterSpacing: '0.1em' }}
            >
              {tempPassword}
            </code>
          </div>
        )}
        <p style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 }}>
          {tempPassword
            ? 'Use this to sign in, then change your password immediately.'
            : 'Click the link in the email to reset your password. It expires in 30 minutes.'}
        </p>
        <Button onClick={() => setAuthScreen('login')} style={{ width: '100%' }}>
          Back to sign in
        </Button>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you instructions."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div
            style={{
              background: 'rgba(229,72,77,0.1)',
              border: '1px solid rgba(229,72,77,0.3)',
              borderRadius: 6,
              padding: '10px 14px',
              color: '#e5484d',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="forgot-email" style={{ color: '#999', fontSize: 12 }}>
            Email
          </Label>
          <Input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoFocus
          />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset instructions'}
        </Button>

        <button
          type="button"
          onClick={() => setAuthScreen('login')}
          style={{
            background: 'none',
            border: 'none',
            color: '#555',
            fontSize: 12,
            cursor: 'pointer',
            textAlign: 'center',
            padding: 0,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#0070f3')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#555')}
        >
          Back to sign in
        </button>
      </form>
    </AuthCard>
  )
}
