import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Key, CopySimple, CheckCircle } from '@phosphor-icons/react'
import { Button } from '../ui/button.js'
import { api } from '../../lib/api.js'
import type { AuthUser } from '../../types/index.js'

interface Props {
  user: AuthUser
  onClose: () => void
}

export function ResetPasswordDialog({ user, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; tempPassword?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleReset() {
    setError(null)
    setLoading(true)
    try {
      const r = await api.users.resetPassword(user.id)
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  function copyTemp() {
    if (result?.tempPassword) {
      void navigator.clipboard.writeText(result.tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            zIndex: 50,
          }}
        />
        <DialogPrimitive.Content
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            zIndex: 51,
            width: 420,
            background: 'var(--t-bg-panel)',
            border: '1px solid var(--t-border-default)',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--t-bg-elevated)',
                border: '1px solid var(--t-border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Key size={18} weight="fill" color="var(--t-text-muted)" />
            </div>
            <div>
              <p
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)', margin: 0 }}
              >
                Reset password
              </p>
              <p style={{ fontSize: 12, color: 'var(--t-text-muted)', margin: '2px 0 0' }}>
                {user.name ?? user.email}
              </p>
            </div>
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(229,72,77,0.1)',
                border: '1px solid rgba(229,72,77,0.3)',
                borderRadius: 6,
                padding: '10px 14px',
                color: '#e5484d',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {!result ? (
            <>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--t-text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                Depending on your auth configuration, this will either:
                <br />• <strong style={{ color: 'var(--t-text-primary)' }}>Email mode</strong> —
                send a reset link to {user.email}
                <br />• <strong style={{ color: 'var(--t-text-primary)' }}>Admin mode</strong> —
                generate a temporary password shown below
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button size="sm" disabled={loading} onClick={() => void handleReset()}>
                  {loading ? 'Resetting…' : 'Reset password'}
                </Button>
              </div>
            </>
          ) : (
            <>
              {result.tempPassword ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--t-text-secondary)', marginBottom: 12 }}>
                    Share this temporary password with the user. It will prompt them to change it on
                    next login.
                  </p>
                  <div
                    style={{
                      background: 'var(--t-bg-elevated)',
                      border: '1px solid var(--t-border-default)',
                      borderRadius: 8,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 20,
                    }}
                  >
                    <code
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: 'var(--t-text-primary)',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {result.tempPassword}
                    </code>
                    <button
                      onClick={copyTemp}
                      title="Copy"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: copied ? '#3dd68c' : 'var(--t-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                      }}
                    >
                      {copied ? (
                        <CheckCircle size={16} weight="fill" color="#3dd68c" />
                      ) : (
                        <CopySimple size={16} />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--t-text-secondary)', marginBottom: 20 }}>
                  A reset link has been sent to{' '}
                  <strong style={{ color: 'var(--t-text-primary)' }}>{user.email}</strong>. It
                  expires in 30 minutes.
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button size="sm" onClick={onClose}>
                  Done
                </Button>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
