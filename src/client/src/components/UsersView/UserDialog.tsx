import { useState, useEffect, type FormEvent } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Label } from '../ui/label.js'
import { api } from '../../lib/api.js'
import type { AuthUser } from '../../types/index.js'

interface Props {
  open: boolean
  user: AuthUser | null // null = create mode
  onClose: () => void
  onSaved: () => void
}

export function UserDialog({ open, user, onClose, onSaved }: Props) {
  const isEdit = user !== null

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'super_admin' | 'member'>('member')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Populate fields when editing
  useEffect(() => {
    if (user) {
      setName(user.name ?? '')
      setEmail(user.email)
      setRole(user.globalRole)
      setIsActive(user.isActive)
      setPassword('')
    } else {
      setName('')
      setEmail('')
      setPassword('')
      setRole('member')
      setIsActive(true)
    }
    setError(null)
  }, [user, open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isEdit) {
        await api.users.update(user!.id, { name, email, globalRole: role, isActive })
      } else {
        if (!password) {
          setError('Password is required')
          setLoading(false)
          return
        }
        await api.users.create({ email, name, password, globalRole: role })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit user' : 'New user'}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}
        >
          {error && (
            <div
              style={{
                background: 'rgba(229,72,77,0.1)',
                border: '1px solid rgba(229,72,77,0.3)',
                borderRadius: 6,
                padding: '10px 14px',
                color: 'var(--t-accent-danger)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
              Email <span style={{ color: 'var(--t-accent-danger)' }}>*</span>
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              required
            />
          </div>

          {!isEdit && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                Password <span style={{ color: 'var(--t-accent-danger)' }}>*</span>
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>Role</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'super_admin' | 'member')}
                style={{
                  height: 36,
                  borderRadius: 6,
                  padding: '0 10px',
                  fontSize: 13,
                  background: 'var(--t-bg-elevated)',
                  border: '1px solid var(--t-border-default)',
                  color: 'var(--t-text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="member">Member</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            {isEdit && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>Status</Label>
                <select
                  value={isActive ? 'active' : 'inactive'}
                  onChange={(e) => setIsActive(e.target.value === 'active')}
                  style={{
                    height: 36,
                    borderRadius: 6,
                    padding: '0 10px',
                    fontSize: 13,
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border-default)',
                    color: 'var(--t-text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>

          <DialogFooter style={{ marginTop: 4 }}>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
