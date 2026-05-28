import { useState, type FormEvent } from 'react'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Label } from '../ui/label.js'
import { AuthCard } from './LoginView.js'
import { useAuth } from '../../contexts/AuthContext.js'
import { api } from '../../lib/api.js'

export function ResetPasswordView() {
  const { resetToken, setAuthScreen } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (!resetToken) {
      setError('Invalid or missing reset token. Please request a new reset link.')
      return
    }
    setLoading(true)
    try {
      await api.auth.resetPassword(resetToken, newPassword)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthCard title="Password updated" subtitle="Your password has been reset successfully.">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(0,112,243,0.1)',
              border: '1px solid rgba(0,112,243,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 22,
            }}
          >
            ✓
          </div>
          <p style={{ fontSize: 13, color: '#666' }}>You can now sign in with your new password.</p>
        </div>
        <Button onClick={() => setAuthScreen('login')} style={{ width: '100%' }}>
          Sign in
        </Button>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Set a new password" subtitle="Choose a strong password for your account.">
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
          <Label htmlFor="new-password" style={{ color: '#999', fontSize: 12 }}>
            New password
          </Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="confirm-password" style={{ color: '#999', fontSize: 12 }}>
            Confirm password
          </Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <Button type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? 'Updating…' : 'Set new password'}
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
