import { useState } from 'react'
import { SquaresFour, Plus, Trash, ArrowRight, PencilSimple } from '@phosphor-icons/react'
import { RowMenu } from '@/components/ui/row-menu.js'
import { Button } from '@/components/ui/button.js'
import { Input } from '@/components/ui/input.js'
import { Label } from '@/components/ui/label.js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog.js'
import { ConfirmDialog } from '@/components/ui/confirm-dialog.js'
import type { App, View, UpdateAppPayload } from '../../types/index.js'

interface Props {
  apps: App[]
  onNavigate: (v: View) => void
  onAdd: (data: { name: string; description?: string }) => Promise<App | undefined>
  onRename: (id: number, data: UpdateAppPayload) => Promise<App>
  onDelete: (id: number) => Promise<void>
}

function NewAppDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onAdd: Props['onAdd']
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onAdd({ name: name.trim(), description: desc.trim() || undefined })
      setName('')
      setDesc('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create App</DialogTitle>
          <DialogDescription>
            Apps are top-level containers for your test spaces and runs.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-app-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-app-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Application"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-app-desc">Description</Label>
            <Input
              id="new-app-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Plus size={14} />
              {saving ? 'Creating…' : 'Create App'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AppsView({ apps, onNavigate, onAdd, onRename, onDelete }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirm, setConfirm] = useState<{ id: number; name: string } | null>(null)
  const [renameTarget, setRenameTarget] = useState<{
    id: number
    name: string
    description: string | null
  } | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renameDesc, setRenameDesc] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  const _handleDelete = (app: App, e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirm({ id: app.id, name: app.name })
  }

  const openRename = (app: App) => {
    setRenameTarget({ id: app.id, name: app.name, description: app.description ?? null })
    setRenameName(app.name)
    setRenameDesc(app.description ?? '')
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTarget || !renameName.trim()) return
    setRenaming(true)
    try {
      await onRename(renameTarget.id, {
        name: renameName.trim(),
        description: renameDesc.trim() || undefined,
      })
      setRenameTarget(null)
    } finally {
      setRenaming(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--t-bg-base)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 32px' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: 'var(--t-text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.3,
              }}
            >
              Apps
            </h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 4 }}>
              Manage your top-level application containers.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} style={{ gap: 6 }}>
            <Plus size={14} />
            New App
          </Button>
        </div>

        {/* Empty state */}
        {apps.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              padding: '80px 24px',
              textAlign: 'center',
              border: '1px dashed var(--t-border-default)',
              borderRadius: 12,
              background: 'var(--t-bg-surface)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'var(--t-bg-panel)',
                border: '1px solid var(--t-border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SquaresFour size={26} weight="duotone" color="var(--t-text-muted)" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--t-text-primary)' }}>
                No apps yet
              </p>
              <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 6 }}>
                Create your first app to get started with test management.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} variant="outline" style={{ gap: 6 }}>
              <Plus size={14} />
              Create App
            </Button>
          </div>
        ) : (
          <div
            style={{
              border: '1px solid var(--t-border-subtle)',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'var(--t-bg-surface)',
            }}
          >
            {apps.map((app, i) => {
              const isHovered = hoveredId === app.id
              return (
                <div
                  key={app.id}
                  onClick={() => onNavigate({ type: 'spaces', appId: app.id })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 18px',
                    cursor: 'pointer',
                    borderTop: i > 0 ? '1px solid var(--t-border-subtle)' : 'none',
                    background: isHovered ? 'var(--t-bg-hover)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={() => setHoveredId(app.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'var(--t-bg-panel)',
                      border: '1px solid var(--t-border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <SquaresFour size={16} weight="duotone" color="var(--t-text-muted)" />
                  </div>

                  {/* Name + description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)' }}>
                      {app.name}
                    </p>
                    {app.description && (
                      <p
                        style={{
                          fontSize: 12,
                          color: 'var(--t-text-muted)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {app.description}
                      </p>
                    )}
                  </div>

                  {/* ⋯ context menu */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      alwaysVisible={isHovered}
                      items={[
                        {
                          label: 'Rename',
                          icon: <PencilSimple size={13} />,
                          action: () => openRename(app),
                        },
                        {
                          label: 'Delete',
                          icon: <Trash size={13} />,
                          action: () => setConfirm({ id: app.id, name: app.name }),
                          destructive: true,
                          separator: true,
                        },
                      ]}
                    />
                  </div>

                  <ArrowRight
                    size={14}
                    color="var(--t-text-secondary)"
                    style={{
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 0.15s',
                      flexShrink: 0,
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <NewAppDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={onAdd} />

      <ConfirmDialog
        open={confirm !== null}
        title="Delete app"
        description={`"${confirm?.name}" and all its spaces, folders, tests, and runs will be permanently deleted.`}
        confirmLabel="Delete App"
        onConfirm={async () => {
          if (confirm) {
            await onDelete(confirm.id)
            setConfirm(null)
          }
        }}
        onCancel={() => setConfirm(null)}
      />

      {/* Rename dialog */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRenameTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename App</DialogTitle>
            <DialogDescription>Update the name or description of this app.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rename-app-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rename-app-name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="App name"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rename-app-desc">Description</Label>
              <Input
                id="rename-app-desc"
                value={renameDesc}
                onChange={(e) => setRenameDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={renaming || !renameName.trim()}>
                {renaming ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
