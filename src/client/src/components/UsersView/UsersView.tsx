import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  PencilSimple,
  Trash,
  Key,
  CheckCircle,
  XCircle,
  ShieldStar,
} from '@phosphor-icons/react'
import { Button } from '../ui/button.js'
import { ConfirmDialog } from '../ui/confirm-dialog.js'
import { api } from '../../lib/api.js'
import type { AuthUser } from '../../types/index.js'
import { UserDialog } from './UserDialog.js'
import { ResetPasswordDialog } from './ResetPasswordDialog.js'
import { SkeletonRows } from '../ui/skeleton.js'

// ─── Row ──────────────────────────────────────────────────────────────────────

function UserRow({
  user,
  onEdit,
  onResetPassword,
  onDelete,
}: {
  user: AuthUser
  onEdit: (u: AuthUser) => void
  onResetPassword: (u: AuthUser) => void
  onDelete: (u: AuthUser) => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 180px 100px 80px 120px',
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: '1px solid var(--t-border-subtle)',
        gap: 8,
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.background = 'var(--t-bg-hover)')
      }
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
    >
      {/* Name / email */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-text-primary)' }}>
          {user.name ?? '—'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{user.email}</div>
      </div>

      {/* Email (shown on larger layout — already in name col) */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--t-text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
      </div>

      {/* Role */}
      <div>
        {user.globalRole === 'super_admin' ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: 'var(--t-text-primary)',
              background: 'var(--t-bg-surface)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 6,
              padding: '2px 8px',
            }}
          >
            <ShieldStar size={10} weight="fill" /> Admin
          </span>
        ) : (
          <span
            style={{
              fontSize: 11,
              color: 'var(--t-text-muted)',
              background: 'var(--t-bg-elevated)',
              border: '1px solid var(--t-border-subtle)',
              borderRadius: 6,
              padding: '2px 8px',
            }}
          >
            Member
          </span>
        )}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {user.isActive ? (
          <CheckCircle size={14} weight="fill" color="#3dd68c" />
        ) : (
          <XCircle size={14} weight="fill" color="#e5484d" />
        )}
        <span style={{ fontSize: 12, color: user.isActive ? '#3dd68c' : '#e5484d' }}>
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        <IconBtn title="Edit" onClick={() => onEdit(user)}>
          <PencilSimple size={13} />
        </IconBtn>
        <IconBtn title="Reset password" onClick={() => onResetPassword(user)}>
          <Key size={13} />
        </IconBtn>
        <IconBtn title="Delete" danger onClick={() => onDelete(user)}>
          <Trash size={13} />
        </IconBtn>
      </div>
    </div>
  )
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        border: 'none',
        borderRadius: 6,
        background: 'transparent',
        color: danger ? '#e5484d' : 'var(--t-text-secondary)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = danger
          ? 'rgba(229,72,77,0.1)'
          : 'var(--t-bg-hover)'
        ;(e.currentTarget as HTMLElement).style.color = danger ? '#e5484d' : 'var(--t-text-primary)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
        ;(e.currentTarget as HTMLElement).style.color = danger
          ? '#e5484d'
          : 'var(--t-text-secondary)'
      }}
    >
      {children}
    </button>
  )
}

// ─── Header row ───────────────────────────────────────────────────────────────

function TableHeader() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 180px 100px 80px 120px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--t-border-subtle)',
        gap: 8,
      }}
    >
      {['User', 'Joined', 'Role', 'Status', ''].map((h) => (
        <div
          key={h}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--t-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {h}
        </div>
      ))}
    </div>
  )
}

// ─── UsersView ────────────────────────────────────────────────────────────────

export function UsersView() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AuthUser | null>(null)
  const [resetTarget, setResetTarget] = useState<AuthUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setUsers(await api.users.list())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--t-bg-base)',
      }}
    >
      {/* Page header */}
      <div
        style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--t-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--t-text-primary)', margin: 0 }}>
            User Management
          </h1>
          <p style={{ fontSize: 12, color: 'var(--t-text-muted)', margin: '4px 0 0' }}>
            {users.length} user{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} weight="bold" /> New user
        </Button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && <SkeletonRows count={6} rowHeight={52} padding="12px 16px" />}
        {error && (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--t-accent-danger)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
        {!loading && !error && (
          <>
            <TableHeader />
            {users.length === 0 ? (
              <div
                style={{
                  padding: 48,
                  textAlign: 'center',
                  color: 'var(--t-text-muted)',
                  fontSize: 13,
                }}
              >
                No users yet. Create one to get started.
              </div>
            ) : (
              users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onEdit={setEditTarget}
                  onResetPassword={setResetTarget}
                  onDelete={setDeleteTarget}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <UserDialog
        open={createOpen || editTarget !== null}
        user={editTarget}
        onClose={() => {
          setCreateOpen(false)
          setEditTarget(null)
        }}
        onSaved={() => {
          setCreateOpen(false)
          setEditTarget(null)
          void load()
        }}
      />

      {resetTarget && (
        <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.name ?? deleteTarget?.email ?? 'user'}?`}
        description="This will permanently remove the user and revoke all their sessions and API tokens."
        confirmLabel="Delete user"
        onConfirm={async () => {
          if (!deleteTarget) return
          await api.users.delete(deleteTarget.id)
          setDeleteTarget(null)
          void load()
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
