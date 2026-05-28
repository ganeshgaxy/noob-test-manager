import { useState, useEffect, useCallback } from 'react'
import {
  Trash,
  ArrowCounterClockwise,
  FolderSimple,
  TestTube,
  CaretRight,
  CaretDown,
} from '@phosphor-icons/react'
import { api } from '../../lib/api.js'
import { ConfirmDialog } from '@/components/ui/confirm-dialog.js'
import type { Folder, Test } from '../../types/index.js'

// ─── Tree types ───────────────────────────────────────────────────────────────

interface TrashFolderNode extends Folder {
  children: TrashFolderNode[]
  directTests: Test[]
}

interface TrashTree {
  roots: TrashFolderNode[]
  orphanTests: Test[] // tests whose folder is NOT trashed
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

function buildTrashTree(folders: Folder[], tests: Test[]): TrashTree {
  const nodeMap = new Map<number, TrashFolderNode>()
  for (const f of folders) nodeMap.set(f.id, { ...f, children: [], directTests: [] })

  const roots: TrashFolderNode[] = []
  for (const f of folders) {
    const node = nodeMap.get(f.id)!
    const parent = f.parentFolderId != null ? nodeMap.get(f.parentFolderId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const orphanTests: Test[] = []
  for (const t of tests) {
    const folder = nodeMap.get(t.folderId)
    if (folder) folder.directTests.push(t)
    else orphanTests.push(t)
  }

  return { roots, orphanTests }
}

function deepCounts(node: TrashFolderNode): { folders: number; tests: number } {
  let f = node.children.length
  let t = node.directTests.length
  for (const child of node.children) {
    const sub = deepCounts(child)
    f += sub.folders
    t += sub.tests
  }
  return { folders: f, tests: t }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeInTrash(trashedAt: string | null): string {
  if (!trashedAt) return ''
  const ms = Date.now() - new Date(trashedAt).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

type ConfirmTarget = { id: number; label: string; kind: 'test' | 'folder' }

// ─── TrashView ────────────────────────────────────────────────────────────────

export function TrashView({ spaceId }: { spaceId: number }) {
  const [tree, setTree] = useState<TrashTree>({ roots: [], orphanTests: [] })
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.trash.list(spaceId)
      setTree(buildTrashTree(data.folders, data.tests))
    } finally {
      setLoading(false)
    }
  }, [spaceId])

  useEffect(() => {
    load()
  }, [load])

  const toggleCollapse = (id: number) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const restoreTest = async (id: number) => {
    await api.trash.restoreTests(spaceId, [id])
    load()
  }
  const deleteTestPermanently = async (id: number) => {
    await api.trash.deleteTestPermanently(spaceId, id)
    load()
  }
  const restoreFolder = async (id: number) => {
    await api.trash.restoreFolders(spaceId, [id])
    load()
  }
  const deleteFolderPermanently = async (id: number) => {
    await api.trash.deleteFolderPermanently(spaceId, id)
    load()
  }

  const isEmpty = tree.roots.length === 0 && tree.orphanTests.length === 0

  const renderFolder = (node: TrashFolderNode, depth: number): React.ReactNode => {
    const isCollapsed = collapsedIds.has(node.id)
    const hasChildren = node.children.length > 0 || node.directTests.length > 0
    const { folders: fc, tests: tc } = deepCounts(node)
    const countLabel = [
      fc > 0 && `${fc} folder${fc !== 1 ? 's' : ''}`,
      tc > 0 && `${tc} test${tc !== 1 ? 's' : ''}`,
    ]
      .filter(Boolean)
      .join(', ')

    return (
      <div key={node.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 44,
            paddingLeft: 12 + depth * 20,
            paddingRight: 10,
            gap: 6,
            borderRadius: 6,
            border: '1px solid var(--t-border-subtle)',
            background: 'var(--t-bg-surface)',
            marginBottom: 2,
          }}
        >
          <button
            onClick={() => hasChildren && toggleCollapse(node.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              background: 'none',
              border: 'none',
              cursor: hasChildren ? 'pointer' : 'default',
              color: hasChildren ? 'var(--t-text-muted)' : 'transparent',
              flexShrink: 0,
              padding: 0,
            }}
          >
            {isCollapsed ? <CaretRight size={11} /> : <CaretDown size={11} />}
          </button>

          <FolderSimple
            size={14}
            color="var(--t-text-muted)"
            weight="fill"
            style={{ flexShrink: 0 }}
          />

          <span
            style={{
              flex: 1,
              fontSize: 13,
              color: 'var(--t-text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.name}
          </span>

          {countLabel && (
            <span style={{ fontSize: 11, color: 'var(--t-text-muted)', flexShrink: 0 }}>
              {countLabel}
            </span>
          )}
          {timeInTrash(node.trashedAt) && (
            <span style={{ fontSize: 11, color: 'var(--t-text-muted)', flexShrink: 0 }}>
              {timeInTrash(node.trashedAt)}
            </span>
          )}

          <ActionButtons
            onRestore={() => restoreFolder(node.id)}
            onDelete={() => setConfirm({ id: node.id, label: node.name, kind: 'folder' })}
          />
        </div>

        {!isCollapsed && hasChildren && (
          <div style={{ marginBottom: 2 }}>
            {node.children.map((child) => renderFolder(child, depth + 1))}
            {node.directTests.map((t) => renderTest(t, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderTest = (t: Test, depth: number): React.ReactNode => (
    <div
      key={t.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 44,
        // extra 22px to align test icon past caret column
        paddingLeft: 12 + depth * 20 + 22,
        paddingRight: 10,
        gap: 6,
        borderRadius: 6,
        border: '1px solid var(--t-border-subtle)',
        background: 'var(--t-bg-base)',
        marginBottom: 2,
      }}
    >
      <TestTube size={13} color="var(--t-text-muted)" style={{ flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: 'var(--t-text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {t.title}
      </span>
      <span
        style={{
          fontSize: 10,
          color: 'var(--t-text-muted)',
          border: '1px solid var(--t-border-default)',
          borderRadius: 4,
          padding: '1px 6px',
          flexShrink: 0,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {t.type}
      </span>
      {timeInTrash(t.trashedAt) && (
        <span style={{ fontSize: 11, color: 'var(--t-text-muted)', flexShrink: 0 }}>
          {timeInTrash(t.trashedAt)}
        </span>
      )}
      <ActionButtons
        onRestore={() => restoreTest(t.id)}
        onDelete={() => setConfirm({ id: t.id, label: t.title, kind: 'test' })}
      />
    </div>
  )

  return (
    <div
      style={{
        flex: 1,
        background: 'var(--t-bg-base)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 24px 12px',
          borderBottom: '1px solid var(--t-border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trash size={16} color="var(--t-text-muted)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)' }}>
            Trash
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 4 }}>
          Items in trash can be restored or permanently deleted.
        </p>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {loading && <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Loading…</p>}

        {!loading && isEmpty && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 80,
              gap: 10,
              color: 'var(--t-text-muted)',
            }}
          >
            <Trash size={32} />
            <span style={{ fontSize: 13 }}>Trash is empty</span>
          </div>
        )}

        {!loading && !isEmpty && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tree.roots.map((node) => renderFolder(node, 0))}
            {tree.orphanTests.map((t) => renderTest(t, 0))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title="Delete permanently"
        description={`"${confirm?.label}" will be permanently deleted and cannot be recovered.`}
        confirmLabel="Delete permanently"
        onConfirm={async () => {
          if (!confirm) return
          if (confirm.kind === 'test') await deleteTestPermanently(confirm.id)
          else await deleteFolderPermanently(confirm.id)
          setConfirm(null)
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

// ─── Shared action buttons ────────────────────────────────────────────────────

function ActionButtons({ onRestore, onDelete }: { onRestore: () => void; onDelete: () => void }) {
  return (
    <>
      <button
        onClick={onRestore}
        title="Restore"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: 'var(--t-text-secondary)',
          background: 'none',
          border: '1px solid var(--t-border-default)',
          borderRadius: 5,
          padding: '3px 8px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-primary)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-strong)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-default)'
        }}
      >
        <ArrowCounterClockwise size={11} />
        Restore
      </button>
      <button
        onClick={onDelete}
        title="Delete permanently"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '3px 6px',
          background: 'none',
          border: '1px solid transparent',
          borderRadius: 5,
          cursor: 'pointer',
          color: 'var(--t-text-muted)',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--t-accent-danger)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-accent-danger)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-muted)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
        }}
      >
        <Trash size={13} />
      </button>
    </>
  )
}
