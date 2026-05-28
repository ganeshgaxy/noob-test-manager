import { useState, useEffect, type FormEvent } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ShieldCheck, FloppyDisk, CheckCircle, Warning, X } from '@phosphor-icons/react'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Label } from '../ui/label.js'
import { api } from '../../lib/api.js'

type SsoProviderType = 'none' | 'oidc' | 'github'

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (provider: SsoProviderType) => void
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SH({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#444',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
      }}
    >
      {label}
    </div>
  )
}

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
      <Label style={{ fontSize: 12, color: '#888' }}>
        {label}
        {required && <span style={{ color: '#e5484d', marginLeft: 2 }}>*</span>}
      </Label>
      {children}
    </div>
  )
}

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
        border: `1px solid ${active ? '#555' : '#2a2a2a'}`,
        background: active ? 'rgba(255,255,255,0.06)' : '#0d0d0d',
        color: active ? '#ededed' : '#666',
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

// ─── SsoConfigDialog ──────────────────────────────────────────────────────────

export function SsoConfigDialog({ open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ssoProvider, setSsoProvider] = useState<SsoProviderType>('none')
  const [ssoClientId, setSsoClientId] = useState('')
  const [ssoClientSecret, setSsoClientSecret] = useState('')
  const [ssoDiscoveryUrl, setSsoDiscoveryUrl] = useState('')
  const [ssoAutoProvision, setSsoAutoProvision] = useState(true)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (!open) return
    setStatus(null)
    setLoading(true)
    void api.authConfig
      .get()
      .then((cfg) => {
        const c = cfg as {
          sso?: {
            type: string
            clientId?: string
            clientSecret?: string
            discoveryUrl?: string
            autoProvision?: boolean
          }
        }
        if (c.sso?.type) {
          setSsoProvider(c.sso.type as SsoProviderType)
          setSsoClientId(c.sso.clientId ?? '')
          setSsoClientSecret(c.sso.clientSecret ?? '')
          setSsoDiscoveryUrl(c.sso.discoveryUrl ?? '')
          setSsoAutoProvision(c.sso.autoProvision !== false)
        } else {
          setSsoProvider('none')
          setSsoClientId('')
          setSsoClientSecret('')
          setSsoDiscoveryUrl('')
          setSsoAutoProvision(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    try {
      const sso =
        ssoProvider === 'none'
          ? null
          : ssoProvider === 'oidc'
            ? {
                type: ssoProvider,
                clientId: ssoClientId,
                clientSecret: ssoClientSecret,
                discoveryUrl: ssoDiscoveryUrl,
                autoProvision: ssoAutoProvision,
              }
            : {
                type: ssoProvider,
                clientId: ssoClientId,
                clientSecret: ssoClientSecret,
                autoProvision: ssoAutoProvision,
              }
      await api.authConfig.update(sso ? { sso } : { sso: null })
      setStatus({ ok: true, message: 'SSO configuration saved.' })
      onSaved?.(ssoProvider)
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
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
            background: '#111',
            border: '1px solid #222',
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
                  background: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={16} weight="fill" color="#888" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#ededed' }}>
                  Single Sign-On (SSO)
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 11, color: '#555' }}>
                  OIDC &amp; GitHub OAuth configuration
                </p>
              </div>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#555',
                  display: 'flex',
                }}
              >
                <X size={16} />
              </button>
            </DialogPrimitive.Close>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: '#444', fontSize: 13, padding: '32px 0' }}>
              Loading…
            </p>
          ) : (
            <form onSubmit={(e) => void handleSave(e)}>
              <div style={{ marginBottom: 20 }}>
                <SH label="Provider" />
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <ProviderCard
                    label="Disabled"
                    active={ssoProvider === 'none'}
                    onClick={() => setSsoProvider('none')}
                  />
                  <ProviderCard
                    label="OIDC"
                    active={ssoProvider === 'oidc'}
                    onClick={() => setSsoProvider('oidc')}
                  />
                  <ProviderCard
                    label="GitHub"
                    active={ssoProvider === 'github'}
                    onClick={() => setSsoProvider('github')}
                  />
                </div>
                {ssoProvider === 'none' && (
                  <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                    SSO is disabled. Users sign in with email and password. Enable OIDC for Google,
                    Okta, Azure AD, Keycloak, etc., or GitHub for GitHub OAuth.
                  </p>
                )}
                {ssoProvider !== 'none' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Field label="Client ID" required>
                      <Input
                        placeholder="your-client-id"
                        value={ssoClientId}
                        onChange={(e) => setSsoClientId(e.target.value)}
                        required
                      />
                    </Field>
                    <Field label="Client Secret" required>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={ssoClientSecret}
                        onChange={(e) => setSsoClientSecret(e.target.value)}
                        required
                      />
                    </Field>
                    {ssoProvider === 'oidc' && (
                      <Field label="Discovery / Issuer URL" required>
                        <Input
                          placeholder="https://accounts.google.com"
                          value={ssoDiscoveryUrl}
                          onChange={(e) => setSsoDiscoveryUrl(e.target.value)}
                          required
                        />
                        <p style={{ fontSize: 11, color: '#555', margin: '4px 0 0' }}>
                          The issuer URL — discovery doc is fetched from{' '}
                          <code style={{ color: '#888' }}>
                            {'{issuer}'}/.well-known/openid-configuration
                          </code>
                        </p>
                      </Field>
                    )}
                    {ssoProvider === 'github' && (
                      <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                        Create an OAuth App at{' '}
                        <strong>github.com → Settings → Developer settings → OAuth Apps</strong>.
                        Set the callback URL to{' '}
                        <code style={{ color: '#888', fontSize: 11 }}>
                          {window.location.origin}/api/auth/sso/callback
                        </code>
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        id="ssoAutoProvision"
                        checked={ssoAutoProvision}
                        onChange={(e) => setSsoAutoProvision(e.target.checked)}
                        style={{ accentColor: '#888', width: 14, height: 14 }}
                      />
                      <label
                        htmlFor="ssoAutoProvision"
                        style={{ fontSize: 12, color: '#888', cursor: 'pointer' }}
                      >
                        Auto-create user account on first SSO sign-in
                      </label>
                    </div>
                  </div>
                )}
              </div>

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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
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
