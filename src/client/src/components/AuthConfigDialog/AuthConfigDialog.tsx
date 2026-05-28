import { useState, useEffect, type FormEvent } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  ShieldCheck,
  FloppyDisk,
  PaperPlaneTilt,
  CheckCircle,
  Warning,
  X,
} from '@phosphor-icons/react'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Label } from '../ui/label.js'
import { api } from '../../lib/api.js'

// ─── Types (mirrors server's AuthConfig) ──────────────────────────────────────

type ResetMode = 'admin' | 'email'
type ProviderType = 'smtp' | 'resend' | 'sendgrid'

interface SmtpFields {
  host: string
  port: string
  secure: boolean
  user: string
  pass: string
  from: string
}
interface ApiKeyFields {
  apiKey: string
  from: string
}

const defaultSmtp: SmtpFields = {
  host: '',
  port: '587',
  secure: false,
  user: '',
  pass: '',
  from: '',
}
const defaultApiKey: ApiKeyFields = { apiKey: '', from: '' }

interface Props {
  open: boolean
  onClose: () => void
}

// ─── Shared section header ────────────────────────────────────────────────────

function SH({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--t-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
      }}
    >
      {label}
    </div>
  )
}

// ─── Labelled input ───────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>
        {label}
        {required && <span style={{ color: '#e5484d', marginLeft: 2 }}>*</span>}
      </Label>
      {children}
    </div>
  )
}

// ─── Provider card selector ───────────────────────────────────────────────────

function ProviderCard({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 0',
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--t-border-strong)' : 'var(--t-border-default)'}`,
        background: active ? 'var(--t-bg-hover)' : 'var(--t-bg-elevated)',
        color: active ? 'var(--t-text-primary)' : 'var(--t-text-secondary)',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export function AuthConfigDialog({ open, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [resetMode, setResetMode] = useState<ResetMode>('admin')
  const [providerType, setProviderType] = useState<ProviderType>('smtp')
  const [smtp, setSmtp] = useState<SmtpFields>(defaultSmtp)
  const [apiKey, setApiKey] = useState<ApiKeyFields>(defaultApiKey)
  const [sessionDays, setSessionDays] = useState('7')

  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)

  // Load current config when dialog opens
  useEffect(() => {
    if (!open) return
    setStatus(null)
    setLoading(true)
    void api.authConfig
      .get()
      .then((cfg) => {
        const c = cfg as {
          sessionDays?: number
          passwordReset: {
            type: string
            emailProvider?: {
              type: string
              host?: string
              port?: number
              secure?: boolean
              user?: string
              pass?: string
              apiKey?: string
              from?: string
            }
          }
        }
        setSessionDays(String(c.sessionDays ?? 7))
        const pr = c.passwordReset
        setResetMode(pr.type === 'email' ? 'email' : 'admin')
        if (pr.type === 'email' && pr.emailProvider) {
          const ep = pr.emailProvider
          setProviderType((ep.type ?? 'smtp') as ProviderType)
          if (ep.type === 'smtp') {
            setSmtp({
              host: ep.host ?? '',
              port: String(ep.port ?? 587),
              secure: ep.secure ?? false,
              user: ep.user ?? '',
              pass: ep.pass ?? '',
              from: ep.from ?? '',
            })
          } else {
            setApiKey({ apiKey: ep.apiKey ?? '', from: ep.from ?? '' })
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  function buildPayload() {
    const base = { sessionDays: Number(sessionDays) }
    if (resetMode === 'admin') {
      return { ...base, passwordReset: { type: 'admin' } }
    }
    const emailBase = {
      type: providerType,
      from: providerType === 'smtp' ? smtp.from : apiKey.from,
    }
    const provider =
      providerType === 'smtp'
        ? {
            ...emailBase,
            host: smtp.host,
            port: Number(smtp.port),
            secure: smtp.secure,
            user: smtp.user,
            pass: smtp.pass,
          }
        : { ...emailBase, apiKey: apiKey.apiKey }
    return { ...base, passwordReset: { type: 'email', emailProvider: provider } }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    try {
      await api.authConfig.update(buildPayload() as Record<string, unknown>)
      setStatus({ ok: true, message: 'Configuration saved.' })
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestEmail() {
    setTesting(true)
    setStatus(null)
    try {
      const r = await api.authConfig.testEmail(buildPayload() as Record<string, unknown>)
      setStatus({
        ok: r.ok,
        message: r.ok ? `Test email sent to ${r.sentTo}` : (r.error ?? 'Test failed'),
      })
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
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
            width: 500,
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--t-bg-panel)',
            border: '1px solid var(--t-border-default)',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--t-bg-elevated)',
                  border: '1px solid var(--t-border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={16} weight="fill" color="#888" />
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--t-text-primary)',
                  }}
                >
                  Auth Configuration
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>
                  Password reset &amp; session duration
                </p>
              </div>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--t-text-muted)',
                  display: 'flex',
                }}
              >
                <X size={16} />
              </button>
            </DialogPrimitive.Close>
          </div>

          {loading ? (
            <p
              style={{
                textAlign: 'center',
                color: 'var(--t-text-muted)',
                fontSize: 13,
                padding: '32px 0',
              }}
            >
              Loading…
            </p>
          ) : (
            <form onSubmit={(e) => void handleSave(e)}>
              {/* Session */}
              <div style={{ marginBottom: 20 }}>
                <SH label="Session" />
                <Field label="Session length (days)">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={sessionDays}
                    onChange={(e) => setSessionDays(e.target.value)}
                    style={{ width: 120 }}
                  />
                </Field>
              </div>

              {/* Password reset mode */}
              <div style={{ marginBottom: 20 }}>
                <SH label="Password Reset Mode" />
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <ProviderCard
                    label="Admin only"
                    active={resetMode === 'admin'}
                    onClick={() => setResetMode('admin')}
                  />
                  <ProviderCard
                    label="Email link"
                    active={resetMode === 'email'}
                    onClick={() => setResetMode('email')}
                  />
                </div>
                {resetMode === 'admin' && (
                  <p style={{ fontSize: 12, color: 'var(--t-text-muted)', lineHeight: 1.6 }}>
                    Admins generate a one-time temporary password via the User Management panel. No
                    email provider needed.
                  </p>
                )}
              </div>

              {/* Email provider config */}
              {resetMode === 'email' && (
                <div style={{ marginBottom: 20 }}>
                  <SH label="Email Provider" />
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <ProviderCard
                      label="SMTP"
                      active={providerType === 'smtp'}
                      onClick={() => setProviderType('smtp')}
                    />
                    <ProviderCard
                      label="Resend"
                      active={providerType === 'resend'}
                      onClick={() => setProviderType('resend')}
                    />
                    <ProviderCard
                      label="SendGrid"
                      active={providerType === 'sendgrid'}
                      onClick={() => setProviderType('sendgrid')}
                    />
                  </div>

                  {/* From address (all providers) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Field label="From address" required>
                      <Input
                        type="email"
                        placeholder="noreply@company.com"
                        value={providerType === 'smtp' ? smtp.from : apiKey.from}
                        onChange={(e) =>
                          providerType === 'smtp'
                            ? setSmtp((s) => ({ ...s, from: e.target.value }))
                            : setApiKey((a) => ({ ...a, from: e.target.value }))
                        }
                        required
                      />
                    </Field>

                    {providerType === 'smtp' && (
                      <>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <Field label="SMTP host" required>
                            <Input
                              placeholder="smtp.gmail.com"
                              value={smtp.host}
                              onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
                              required
                            />
                          </Field>
                          <Field label="Port" required>
                            <Input
                              type="number"
                              placeholder="587"
                              style={{ width: 80 }}
                              value={smtp.port}
                              onChange={(e) => setSmtp((s) => ({ ...s, port: e.target.value }))}
                              required
                            />
                          </Field>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            id="smtpSecure"
                            checked={smtp.secure}
                            onChange={(e) => setSmtp((s) => ({ ...s, secure: e.target.checked }))}
                            style={{ accentColor: 'var(--t-text-muted)', width: 14, height: 14 }}
                          />
                          <label
                            htmlFor="smtpSecure"
                            style={{
                              fontSize: 12,
                              color: 'var(--t-text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            Use TLS (port 465)
                          </label>
                        </div>
                        <Field label="SMTP user">
                          <Input
                            placeholder="user@company.com"
                            value={smtp.user}
                            onChange={(e) => setSmtp((s) => ({ ...s, user: e.target.value }))}
                          />
                        </Field>
                        <Field label="SMTP password">
                          <Input
                            type="password"
                            placeholder="••••••••"
                            value={smtp.pass}
                            onChange={(e) => setSmtp((s) => ({ ...s, pass: e.target.value }))}
                          />
                        </Field>
                      </>
                    )}

                    {(providerType === 'resend' || providerType === 'sendgrid') && (
                      <Field label="API key" required>
                        <Input
                          type="password"
                          placeholder={providerType === 'resend' ? 're_...' : 'SG....'}
                          value={apiKey.apiKey}
                          onChange={(e) => setApiKey((a) => ({ ...a, apiKey: e.target.value }))}
                          required
                        />
                      </Field>
                    )}
                  </div>
                </div>
              )}

              {/* Status */}
              {status && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: status.ok ? 'rgba(61,214,140,0.08)' : 'rgba(229,72,77,0.08)',
                    border: `1px solid ${status.ok ? 'rgba(61,214,140,0.25)' : 'rgba(229,72,77,0.25)'}`,
                    marginBottom: 16,
                  }}
                >
                  {status.ok ? (
                    <CheckCircle size={15} weight="fill" color="#3dd68c" />
                  ) : (
                    <Warning size={15} weight="fill" color="#e5484d" />
                  )}
                  <span style={{ fontSize: 13, color: status.ok ? '#3dd68c' : '#e5484d' }}>
                    {status.message}
                  </span>
                </div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                {resetMode === 'email' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testing}
                    onClick={() => void handleTestEmail()}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <PaperPlaneTilt size={13} weight="fill" />
                    {testing ? 'Sending…' : 'Test email'}
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FloppyDisk size={13} weight="fill" />
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
