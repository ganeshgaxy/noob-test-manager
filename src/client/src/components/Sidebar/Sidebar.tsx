import { useState, useEffect, useMemo } from 'react'
import {
  Cube,
  FolderSimple,
  Play,
  CaretRight,
  CaretDown,
  TestTube,
  Plus,
  Trash,
  GearSix,
  SquaresFour,
  CopySimple,
  Scissors,
  ClipboardText,
  PencilSimple,
  Sliders,
  Users,
  UsersThree,
  UserCircle,
  SignOut,
  Key,
  Tag,
  X,
  MagnifyingGlass,
  ArrowsInSimple,
  ArrowsOutSimple,
} from '@phosphor-icons/react'
import { RowMenu, type RowMenuItem } from '@/components/ui/row-menu.js'
import { Input } from '@/components/ui/input.js'
import { Label } from '@/components/ui/label.js'
import { Button } from '@/components/ui/button.js'
import { TagPill } from '@/components/ui/tag-picker.js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.js'
import { ConfirmDialog } from '@/components/ui/confirm-dialog.js'
import type {
  App,
  Space,
  FolderNode,
  View,
  TestRun,
  GlobalTag,
  SpaceTag,
} from '../../types/index.js'
import { useClipboard } from '../../contexts/ClipboardContext.js'
import { useFolders } from '../../features/folders/hooks.js'
import { useAuth } from '../../contexts/AuthContext.js'
import { api } from '../../lib/api.js'

interface Props {
  apps: App[]
  selectedApp: App | null
  spaces: Space[]
  runs: TestRun[]
  view: View
  onNavigate: (v: View) => void
  onAddApp: (d: { name: string; description?: string }) => Promise<App>
  onDeleteApp: (id: number) => Promise<void>
  onAddSpace: (d: { name: string; description?: string }) => Promise<unknown>
  onDeleteSpace: (id: number) => Promise<void>
  onCreateRun: (d: { name: string; environment?: string }) => Promise<TestRun | undefined>
  onDeleteRun: (id: number) => Promise<void>
  onDuplicateRun: (id: number) => Promise<void>
}

type ConfirmTarget = { kind: 'app' | 'space' | 'folder' | 'run'; id: number; name: string }

// ─── Dock button ──────────────────────────────────────────────────────────────

function DockBtn({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      title={disabled ? `${label} (select an app first)` : label}
      onClick={disabled ? undefined : onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.12s',
        background: active ? 'var(--t-sidebar-hover)' : 'transparent',
        color: active
          ? 'var(--t-text-primary)'
          : disabled
            ? 'var(--t-border-strong)'
            : 'var(--t-text-muted)',
        outline: active ? '1px solid var(--t-border-default)' : 'none',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'var(--t-sidebar-hover)'
          el.style.color = 'var(--t-text-secondary)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled) {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'transparent'
          el.style.color = 'var(--t-text-muted)'
        }
      }}
    >
      {icon}
    </button>
  )
}

// ─── Search box ───────────────────────────────────────────────────────────────

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        margin: '2px 8px 4px',
        padding: '4px 8px',
        borderRadius: 6,
        background: 'var(--t-bg-surface)',
        border: '1px solid var(--t-border-subtle)',
      }}
    >
      <MagnifyingGlass size={12} style={{ color: 'var(--t-text-muted)', flexShrink: 0 }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          outline: 'none',
          fontSize: 12,
          color: 'var(--t-text-primary)',
          minWidth: 0,
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: 'var(--t-text-muted)',
            display: 'flex',
            lineHeight: 1,
          }}
        >
          <X size={11} />
        </button>
      )}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeaderIconBtn({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        border: 'none',
        cursor: 'pointer',
        background: 'transparent',
        color: 'var(--t-text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'var(--t-sidebar-hover)'
        el.style.color = 'var(--t-text-secondary)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'transparent'
        el.style.color = 'var(--t-text-muted)'
      }}
    >
      {children}
    </button>
  )
}

function SectionHeader({
  label,
  onAdd,
  extraActions,
}: {
  label: string
  onAdd?: () => void
  extraActions?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px 4px',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--t-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {extraActions}
        {onAdd && (
          <SectionHeaderIconBtn title={`New ${label.replace(/s$/, '')}`} onClick={onAdd}>
            <Plus size={11} />
          </SectionHeaderIconBtn>
        )}
      </div>
    </div>
  )
}

// ─── Action row ───────────────────────────────────────────────────────────────

function ActionRow({
  icon,
  label,
  subtitle,
  active,
  depth = 0,
  chevron,
  onClick,
  onDelete,
  onRename,
  onAddChild,
  addChildTitle,
}: {
  icon: React.ReactNode
  label: string
  subtitle?: string
  active?: boolean
  depth?: number
  chevron?: boolean
  onClick: () => void
  onDelete?: () => void
  onRename?: () => void
  onAddChild?: () => void
  addChildTitle?: string
}) {
  const [hovered, setHovered] = useState(false)
  const hasMenu = !!(onDelete || onRename || onAddChild)

  const menuItems = [
    ...(onAddChild
      ? [{ label: addChildTitle ?? 'Add child', icon: <Plus size={13} />, action: onAddChild }]
      : []),
    ...(onRename
      ? [
          {
            label: 'Rename',
            icon: <PencilSimple size={13} />,
            action: onRename,
            separator: !onAddChild,
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: 'Delete',
            icon: <Trash size={13} />,
            action: onDelete,
            destructive: true,
            separator: true,
          },
        ]
      : []),
  ] as RowMenuItem[]

  return (
    <div
      style={{
        position: 'relative',
        margin: '1px 6px',
        borderRadius: 6,
        background: active
          ? 'var(--t-sidebar-hover)'
          : hovered
            ? 'var(--t-sidebar-hover)'
            : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onClick}
        style={{
          width: '100%',
          height: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 10 + depth * 14,
          paddingRight: hovered && hasMenu ? 34 : 8,
          border: 'none',
          cursor: 'pointer',
          borderRadius: 6,
          background: 'transparent',
          color: active
            ? 'var(--t-text-primary)'
            : hovered
              ? 'var(--t-text-secondary)'
              : 'var(--t-text-muted)',
          textAlign: 'left',
          transition: 'color 0.1s, padding-right 0.1s',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            flexShrink: 0,
            display: 'flex',
            alignSelf: 'center',
            color: active
              ? 'var(--t-text-secondary)'
              : hovered
                ? 'var(--t-text-secondary)'
                : 'var(--t-text-muted)',
          }}
        >
          {icon}
        </span>
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: 13,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            {label}
          </span>
          {subtitle && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--t-text-muted)',
                display: 'block',
                marginTop: 2,
                lineHeight: 1.2,
              }}
            >
              {subtitle}
            </span>
          )}
        </span>
        {chevron && !hovered && (
          <CaretRight size={11} color="var(--t-text-muted)" style={{ flexShrink: 0 }} />
        )}
      </button>
      {hasMenu && (
        <div
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          <RowMenu items={menuItems} size={24} alwaysVisible={hovered} />
        </div>
      )}
    </div>
  )
}

// ─── Collapsible folder row ───────────────────────────────────────────────────

function FolderRow({
  node,
  depth,
  isActive,
  isCollapsed,
  onSelect,
  onToggleCollapse,
  onAddSubfolder,
  onDelete,
  onRename,
  onCopy,
  onCut,
  onDuplicate,
  onPaste,
  showPaste,
}: {
  node: FolderNode
  depth: number
  isActive: boolean
  isCollapsed: boolean
  onSelect: () => void
  onToggleCollapse: () => void
  onAddSubfolder: () => void
  onDelete: () => void
  onRename: () => void
  onCopy: () => void
  onCut: () => void
  onDuplicate: () => void
  onPaste?: () => void
  showPaste?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const hasChildren = node.children.length > 0

  const parts: string[] = []
  if (node.children.length > 0)
    parts.push(`${node.children.length} folder${node.children.length !== 1 ? 's' : ''}`)
  if ((node.testCount ?? 0) > 0)
    parts.push(`${node.testCount} test${node.testCount !== 1 ? 's' : ''}`)
  const subtitle = parts.length > 0 ? parts.join(' · ') : undefined

  return (
    <div
      style={{
        position: 'relative',
        margin: '1px 6px',
        borderRadius: 6,
        background: isActive
          ? 'var(--t-sidebar-hover)'
          : hovered
            ? 'var(--t-sidebar-hover)'
            : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Caret / indent zone */}
        <button
          onClick={hasChildren ? onToggleCollapse : undefined}
          style={{
            width: 22 + depth * 14,
            minWidth: 22 + depth * 14,
            height: 44,
            flexShrink: 0,
            border: 'none',
            background: 'transparent',
            cursor: hasChildren ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 6,
            paddingRight: 6,
            color: hovered ? 'var(--t-text-muted)' : 'var(--t-border-strong)',
          }}
        >
          {hasChildren ? isCollapsed ? <CaretRight size={10} /> : <CaretDown size={10} /> : null}
        </button>

        {/* Main content button */}
        <button
          onClick={onSelect}
          style={{
            flex: 1,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingRight: 8,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: isActive
              ? 'var(--t-text-primary)'
              : hovered
                ? 'var(--t-text-secondary)'
                : 'var(--t-text-muted)',
            textAlign: 'left',
            transition: 'color 0.1s',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              color: isActive
                ? 'var(--t-text-secondary)'
                : hovered
                  ? 'var(--t-text-secondary)'
                  : 'var(--t-text-muted)',
              flexShrink: 0,
              alignSelf: 'center',
              display: 'flex',
            }}
          >
            <FolderSimple size={20} weight={isActive ? 'fill' : 'regular'} />
          </span>
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: 13,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}
            >
              {node.name}
            </span>
            {subtitle && (
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--t-text-muted)',
                  display: 'block',
                  marginTop: 2,
                  lineHeight: 1.2,
                }}
              >
                {subtitle}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* ⋮ Row menu (always mounted, opacity-driven by row-action-btn class) */}
      <div
        style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          display: hovered ? 'flex' : 'none',
        }}
      >
        <RowMenu
          size={24}
          alwaysVisible
          items={[
            {
              label: 'Add subfolder',
              icon: <Plus size={13} />,
              action: onAddSubfolder,
            },
            ...(showPaste && onPaste
              ? [
                  {
                    label: 'Paste here',
                    icon: <ClipboardText size={13} />,
                    action: onPaste,
                    separator: true,
                  } as const,
                ]
              : []),
            {
              label: 'Copy',
              icon: <CopySimple size={13} />,
              action: onCopy,
              separator: !(showPaste && onPaste),
            },
            {
              label: 'Cut',
              icon: <Scissors size={13} />,
              action: onCut,
            },
            {
              label: 'Duplicate',
              icon: <CopySimple size={13} weight="fill" />,
              action: onDuplicate,
            },
            {
              label: 'Rename',
              icon: <PencilSimple size={13} />,
              action: onRename,
              separator: true,
            },
            {
              label: 'Delete',
              icon: <Trash size={13} />,
              action: onDelete,
              destructive: true,
              separator: true,
            },
          ]}
        />
      </div>
    </div>
  )
}

// ─── Folder tree with actions ─────────────────────────────────────────────────

function FolderTreeWithActions({
  nodes,
  spaceId,
  appId,
  depth,
  view,
  collapsedIds,
  onNavigate,
  onAddSubfolder,
  onDeleteFolder,
  onRenameFolder,
  onToggleCollapse,
  onCopyFolder,
  onCutFolder,
  onDuplicateFolder,
  onPasteFolder,
  clipboardFolderActive,
  invalidPasteFolderIds,
}: {
  nodes: FolderNode[]
  spaceId: number
  appId: number
  depth: number
  view: View
  collapsedIds: Set<number>
  onNavigate: (v: View) => void
  onAddSubfolder: (parentId: number) => void
  onDeleteFolder: (id: number, name: string) => void
  onRenameFolder: (id: number, name: string) => void
  onToggleCollapse: (id: number) => void
  onCopyFolder: (id: number) => void
  onCutFolder: (id: number) => void
  onDuplicateFolder: (id: number) => void
  onPasteFolder: (targetParentId: number) => void
  clipboardFolderActive: boolean
  invalidPasteFolderIds: Set<number>
}) {
  return (
    <>
      {nodes.map((f) => {
        const isActive =
          (view.type === 'tests' || view.type === 'test-editor') &&
          'folderId' in view &&
          view.folderId === f.id
        const isCollapsed = collapsedIds.has(f.id)
        return (
          <div key={f.id}>
            <FolderRow
              node={f}
              depth={depth}
              isActive={isActive}
              isCollapsed={isCollapsed}
              onSelect={() => onNavigate({ type: 'tests', appId, spaceId, folderId: f.id })}
              onToggleCollapse={() => onToggleCollapse(f.id)}
              onAddSubfolder={() => onAddSubfolder(f.id)}
              onDelete={() => onDeleteFolder(f.id, f.name)}
              onRename={() => onRenameFolder(f.id, f.name)}
              onCopy={() => onCopyFolder(f.id)}
              onCut={() => onCutFolder(f.id)}
              onDuplicate={() => onDuplicateFolder(f.id)}
              onPaste={() => onPasteFolder(f.id)}
              showPaste={clipboardFolderActive && !invalidPasteFolderIds.has(f.id)}
            />
            {f.children.length > 0 && !isCollapsed && (
              <FolderTreeWithActions
                nodes={f.children}
                spaceId={spaceId}
                appId={appId}
                depth={depth + 1}
                view={view}
                collapsedIds={collapsedIds}
                onNavigate={onNavigate}
                onAddSubfolder={onAddSubfolder}
                onDeleteFolder={onDeleteFolder}
                onRenameFolder={onRenameFolder}
                onToggleCollapse={onToggleCollapse}
                onCopyFolder={onCopyFolder}
                onCutFolder={onCutFolder}
                onDuplicateFolder={onDuplicateFolder}
                onPasteFolder={onPasteFolder}
                clipboardFolderActive={clipboardFolderActive}
                invalidPasteFolderIds={invalidPasteFolderIds}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

// ─── MenuRow (used inside user avatar popover) ────────────────────────────────

function MenuRow({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
}) {
  const base = danger ? '#e5484d' : '#aaa'
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '7px 14px',
        background: 'none',
        border: 'none',
        color: base,
        fontSize: 13,
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = danger
          ? 'rgba(229,72,77,0.08)'
          : 'var(--t-sidebar-hover)'
        ;(e.currentTarget as HTMLElement).style.color = danger ? '#ff6166' : 'var(--t-text-primary)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'none'
        ;(e.currentTarget as HTMLElement).style.color = base
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  apps,
  selectedApp,
  spaces,
  runs,
  view,
  onNavigate,
  onAddApp,
  onDeleteApp,
  onAddSpace,
  onDeleteSpace,
  onCreateRun,
  onDeleteRun,
  onDuplicateRun,
}: Props) {
  const [addAppOpen, setAddAppOpen] = useState(false)
  const [addSpaceOpen, setAddSpaceOpen] = useState(false)
  const [addFolderOpen, setAddFolderOpen] = useState(false)
  const [addFolderParentId, setAddFolderParentId] = useState<number | undefined>(undefined)
  const [addRunOpen, setAddRunOpen] = useState(false)
  const [runName, setRunName] = useState('')
  const [runEnv, setRunEnv] = useState('')
  const [hoveredRunId, setHoveredRunId] = useState<number | null>(null)

  const [appName, setAppName] = useState('')
  const [appDesc, setAppDesc] = useState('')
  const [spaceName, setSpaceName] = useState('')
  const [spaceDesc, setSpaceDesc] = useState('')
  const [folderName, setFolderName] = useState('')
  const [folderDesc, setFolderDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<number>>(new Set())
  const { clipboard, copy, cut, clear } = useClipboard()
  const { user: authUser, logout } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Rename state
  type RenameTarget =
    | {
        kind: 'app'
        id: number
        currentName: string
        currentDescription: string | null
      }
    | {
        kind: 'space'
        appId: number
        id: number
        currentName: string
        currentDescription: string | null
      }
    | {
        kind: 'folder'
        spaceId: number
        id: number
        currentName: string
        currentDescription: string | null
      }
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renameDesc, setRenameDesc] = useState('')
  // ── Search state ─────────────────────────────────────────────────────────────
  const [spaceSearch, setSpaceSearch] = useState('')
  const [folderSearch, setFolderSearch] = useState('')
  const [runSearch, setRunSearch] = useState('')

  // Space tags management (shown in rename dialog when target is a space)
  const [spaceTagList, setSpaceTagList] = useState<SpaceTag[]>([])
  const [globalTagList, setGlobalTagList] = useState<GlobalTag[]>([])
  const [newSpaceTagName, setNewSpaceTagName] = useState('')
  const [newSpaceTagColor, setNewSpaceTagColor] = useState('#6366f1')
  const [spaceTagError, setSpaceTagError] = useState('')
  const [spaceTagCreating, setSpaceTagCreating] = useState(false)

  const dockSection =
    view.type === 'runs' || view.type === 'run-execution'
      ? 'runs'
      : view.type === 'settings'
        ? 'settings'
        : view.type === 'trash'
          ? 'trash'
          : view.type === 'users'
            ? 'users'
            : view.type === 'admin-settings'
              ? 'admin-settings'
              : view.type === 'apps'
                ? 'apps'
                : 'nav'
  const activeSpaceId = 'spaceId' in view ? view.spaceId : null
  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? null
  const {
    tree: folderTree,
    addFolder,
    removeFolder,
    refetch: refetchFolders,
  } = useFolders(activeSpaceId)

  // Refresh folder tree (and its test-count subtitles) whenever SpaceView
  // completes a paste / duplicate / delete that changes test counts.
  useEffect(() => {
    const handler = () => void refetchFolders()
    window.addEventListener('sdet:folders:refresh', handler)
    return () => window.removeEventListener('sdet:folders:refresh', handler)
  }, [refetchFolders])

  // Open the Add Folder dialog when SpaceView (or any other component) dispatches this event.
  useEffect(() => {
    const handler = () => {
      setAddFolderParentId(undefined)
      setFolderName('')
      setAddFolderOpen(true)
    }
    window.addEventListener('sdet:open:add-folder', handler)
    return () => window.removeEventListener('sdet:open:add-folder', handler)
  }, [])

  const navLevel: 'apps' | 'spaces' | 'folders' = !selectedApp
    ? 'apps'
    : (view.type === 'tests' || view.type === 'test-editor') && activeSpace
      ? 'folders'
      : selectedApp
        ? 'spaces'
        : 'apps'

  const handleCopyFolder = (id: number) => {
    copy({ kind: 'folder', ids: [id], sourceSpaceId: activeSpaceId ?? undefined })
  }
  const handleCutFolder = (id: number) => {
    cut({ kind: 'folder', ids: [id], sourceSpaceId: activeSpaceId ?? undefined })
  }
  const handleDuplicateFolder = async (id: number) => {
    if (!activeSpaceId) return
    await api.bulk.folders.duplicate({ folderIds: [id], spaceId: activeSpaceId })
    await refetchFolders()
  }
  const handlePasteFolder = async (targetParentId: number) => {
    if (!clipboard || clipboard.kind !== 'folder') return
    const spaceId = clipboard.sourceSpaceId ?? activeSpaceId
    if (!spaceId) return
    if (clipboard.mode === 'copy') {
      await api.bulk.folders.duplicate({
        folderIds: clipboard.ids,
        spaceId,
        targetParentFolderId: targetParentId,
      })
    } else {
      await api.bulk.folders.move({
        folderIds: clipboard.ids,
        targetParentFolderId: targetParentId,
      })
    }
    clear()
    await refetchFolders()
  }
  const clipboardFolderActive = clipboard?.kind === 'folder'

  // Build the set of folder IDs where "Paste here" must be hidden:
  // the clipboard folders themselves + all their descendants.
  const invalidPasteFolderIds = useMemo<Set<number>>(() => {
    if (!clipboardFolderActive || !clipboard) return new Set()
    const ids = clipboard.ids
    const result = new Set<number>()
    function collectAll(node: import('@/types/index.js').FolderNode) {
      result.add(node.id)
      for (const child of node.children) collectAll(child)
    }
    function search(nodes: import('@/types/index.js').FolderNode[]) {
      for (const node of nodes) {
        if (ids.includes(node.id)) collectAll(node)
        else search(node.children)
      }
    }
    search(folderTree)
    return result
  }, [clipboardFolderActive, clipboard, folderTree])

  const handleToggleCollapse = (id: number) => {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Recursively collect every folder id in the tree */
  function collectAllFolderIds(nodes: FolderNode[]): number[] {
    const ids: number[] = []
    function walk(ns: FolderNode[]) {
      for (const n of ns) {
        ids.push(n.id)
        if (n.children.length > 0) walk(n.children)
      }
    }
    walk(nodes)
    return ids
  }

  const handleExpandAll = () => setCollapsedFolderIds(new Set())
  const handleCollapseAll = () => setCollapsedFolderIds(new Set(collectAllFolderIds(folderTree)))

  /** Flatten folder tree into [{node, path}] for search results */
  const flatFolderResults = useMemo(() => {
    if (!folderSearch.trim()) return []
    const q = folderSearch.toLowerCase()
    const results: Array<{ node: FolderNode; path: string }> = []
    function walk(nodes: FolderNode[], parentPath: string) {
      for (const n of nodes) {
        const path = parentPath ? `${parentPath} / ${n.name}` : n.name
        if (n.name.toLowerCase().includes(q)) results.push({ node: n, path })
        walk(n.children, path)
      }
    }
    walk(folderTree, '')
    return results
  }, [folderSearch, folderTree])

  const handleAddApp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!appName.trim()) return
    setSaving(true)
    try {
      const app = await onAddApp({ name: appName.trim(), description: appDesc.trim() || undefined })
      setAppName('')
      setAppDesc('')
      setAddAppOpen(false)
      onNavigate({ type: 'spaces', appId: app.id })
    } finally {
      setSaving(false)
    }
  }

  const handleAddSpace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!spaceName.trim()) return
    setSaving(true)
    try {
      await onAddSpace({ name: spaceName.trim(), description: spaceDesc.trim() || undefined })
      setSpaceName('')
      setSpaceDesc('')
      setAddSpaceOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!folderName.trim()) return
    setSaving(true)
    try {
      await addFolder({
        name: folderName.trim(),
        description: folderDesc.trim() || undefined,
        parentFolderId: addFolderParentId,
      })
      setFolderName('')
      setFolderDesc('')
      setAddFolderParentId(undefined)
      setAddFolderOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const openAddSubfolder = (parentId: number) => {
    setAddFolderParentId(parentId)
    setFolderName('')
    setFolderDesc('')
    setAddFolderOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return
    if (confirmTarget.kind === 'app') await onDeleteApp(confirmTarget.id)
    else if (confirmTarget.kind === 'space') await onDeleteSpace(confirmTarget.id)
    else if (confirmTarget.kind === 'run') await onDeleteRun(confirmTarget.id)
    else if (confirmTarget.kind === 'folder') {
      await removeFolder(confirmTarget.id)
      await refetchFolders()
    }
    setConfirmTarget(null)
  }

  const openRenameApp = (
    id: number,
    currentName: string,
    currentDescription: string | null = null
  ) => {
    setRenameTarget({ kind: 'app', id, currentName, currentDescription })
    setRenameName(currentName)
    setRenameDesc(currentDescription ?? '')
  }
  const openRenameSpace = (
    id: number,
    currentName: string,
    currentDescription: string | null = null
  ) => {
    if (!selectedApp) return
    setRenameTarget({ kind: 'space', appId: selectedApp.id, id, currentName, currentDescription })
    setRenameName(currentName)
    setRenameDesc(currentDescription ?? '')
    setNewSpaceTagName('')
    setSpaceTagError('')
    // Load space tags + global tags for the tags section
    api.spaceTags
      .list(id)
      .then(setSpaceTagList)
      .catch(() => {})
    api.globalTags
      .list()
      .then(setGlobalTagList)
      .catch(() => {})
  }
  const openRenameFolder = (
    id: number,
    currentName: string,
    currentDescription?: string | null
  ) => {
    if (!activeSpaceId) return
    setRenameTarget({
      kind: 'folder',
      spaceId: activeSpaceId,
      id,
      currentName,
      currentDescription: currentDescription ?? null,
    })
    setRenameName(currentName)
    setRenameDesc(currentDescription ?? '')
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTarget || !renameName.trim()) return
    setSaving(true)
    try {
      const name = renameName.trim()
      const description = renameDesc.trim() || undefined
      if (renameTarget.kind === 'app') {
        await api.apps.update(renameTarget.id, { name, description })
        window.dispatchEvent(new CustomEvent('sdet:apps:refresh'))
      } else if (renameTarget.kind === 'space') {
        await api.spaces.update(renameTarget.appId, renameTarget.id, { name, description })
        window.dispatchEvent(new CustomEvent('sdet:spaces:refresh'))
      } else if (renameTarget.kind === 'folder') {
        await api.folders.update(renameTarget.spaceId, renameTarget.id, {
          name,
          description: description ?? null,
        })
        await refetchFolders()
      }
      setRenameTarget(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
      {/* ── Dock ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          width: 52,
          flexShrink: 0,
          background: 'var(--t-bg-base)',
          borderRight: '1px solid var(--t-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          paddingBottom: 8,
          gap: 2,
        }}
      >
        <DockBtn
          icon={<SquaresFour size={17} weight={dockSection === 'apps' ? 'fill' : 'regular'} />}
          label="Apps"
          active={dockSection === 'apps'}
          onClick={() => onNavigate({ type: 'apps' })}
        />
        <div
          style={{ height: 1, width: 24, background: 'var(--t-border-subtle)', margin: '4px 0' }}
        />
        <DockBtn
          icon={<TestTube size={17} weight={dockSection === 'nav' ? 'fill' : 'regular'} />}
          label="Spaces & Folders"
          active={dockSection === 'nav'}
          disabled={!selectedApp}
          onClick={() => {
            if (selectedApp) onNavigate({ type: 'spaces', appId: selectedApp.id })
          }}
        />
        <DockBtn
          icon={<Play size={17} weight={dockSection === 'runs' ? 'fill' : 'regular'} />}
          label="Test Runs"
          active={dockSection === 'runs'}
          disabled={!selectedApp}
          onClick={() => {
            if (selectedApp) onNavigate({ type: 'runs', appId: selectedApp.id })
          }}
        />
        <DockBtn
          icon={<Sliders size={17} weight={dockSection === 'settings' ? 'fill' : 'regular'} />}
          label="Settings"
          active={dockSection === 'settings'}
          disabled={!selectedApp}
          onClick={() => {
            if (selectedApp) onNavigate({ type: 'settings', appId: selectedApp.id })
          }}
        />
        <DockBtn
          icon={<Trash size={17} weight={dockSection === 'trash' ? 'fill' : 'regular'} />}
          label="Trash"
          active={dockSection === 'trash'}
          disabled={!selectedApp || !activeSpaceId}
          onClick={() => {
            if (selectedApp && activeSpaceId)
              onNavigate({ type: 'trash', appId: selectedApp.id, spaceId: activeSpaceId })
          }}
        />
        {/* Spacer pushes bottom buttons down */}
        <div style={{ flex: 1 }} />
        <div
          style={{ height: 1, width: 24, background: 'var(--t-border-subtle)', margin: '4px 0' }}
        />
        {authUser?.globalRole === 'super_admin' && (
          <DockBtn
            icon={<Users size={17} weight={dockSection === 'users' ? 'fill' : 'regular'} />}
            label="User Management"
            active={dockSection === 'users'}
            onClick={() => onNavigate({ type: 'users', section: 'users' })}
          />
        )}
        {authUser?.globalRole === 'super_admin' && (
          <DockBtn
            icon={
              <GearSix size={17} weight={dockSection === 'admin-settings' ? 'fill' : 'regular'} />
            }
            label="Admin Settings"
            active={dockSection === 'admin-settings'}
            onClick={() => onNavigate({ type: 'admin-settings' })}
          />
        )}

        {/* ── User avatar button ──────────────────────────────────────── */}
        <div style={{ position: 'relative' }}>
          <button
            title={authUser?.name ?? authUser?.email ?? 'Account'}
            onClick={() => setUserMenuOpen((o) => !o)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: userMenuOpen ? 'var(--t-sidebar-hover)' : 'transparent',
              border: userMenuOpen ? '1px solid var(--t-border-default)' : '1px solid transparent',
              cursor: 'pointer',
              color: userMenuOpen ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
              transition: 'all 0.12s',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              if (!userMenuOpen) {
                ;(e.currentTarget as HTMLElement).style.background = 'var(--t-sidebar-hover)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!userMenuOpen) {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = '#666'
              }
            }}
          >
            {authUser?.name ? (
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'var(--t-bg-surface)',
                  border: '1px solid var(--t-border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--t-text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                {authUser.name.charAt(0).toUpperCase()}
              </div>
            ) : (
              <UserCircle size={22} />
            )}
          </button>

          {/* Popover menu */}
          {userMenuOpen && (
            <>
              {/* Backdrop to close on outside click */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                onClick={() => setUserMenuOpen(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 48,
                  left: 0,
                  zIndex: 200,
                  background: 'var(--t-bg-panel)',
                  border: '1px solid var(--t-border-default)',
                  borderRadius: 10,
                  padding: '6px 0',
                  minWidth: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              >
                {/* User info header */}
                <div
                  style={{
                    padding: '8px 14px 10px',
                    borderBottom: '1px solid var(--t-border-subtle)',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>
                    {authUser?.name ?? '—'}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--t-text-muted)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {authUser?.email}
                  </div>
                  {authUser?.globalRole === 'super_admin' && (
                    <span
                      style={{
                        display: 'inline-flex',
                        marginTop: 6,
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--t-text-secondary)',
                        background: 'var(--t-bg-surface)',
                        border: '1px solid rgba(0,112,243,0.25)',
                        borderRadius: 5,
                        padding: '1px 7px',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Super Admin
                    </span>
                  )}
                </div>

                {/* Change password */}
                <MenuRow
                  icon={<Key size={13} />}
                  label="Change password"
                  onClick={() => {
                    setUserMenuOpen(false)
                    onNavigate({ type: 'settings', appId: selectedApp?.id ?? 0 })
                  }}
                />

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--t-border-subtle)', margin: '4px 0' }} />

                {/* Sign out */}
                <MenuRow
                  icon={<SignOut size={13} />}
                  label="Sign out"
                  danger
                  onClick={() => {
                    setUserMenuOpen(false)
                    void logout()
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Nav panel ────────────────────────────────────────────────────── */}
      {dockSection !== 'apps' && dockSection !== 'trash' && dockSection !== 'admin-settings' && (
        <div
          style={{
            width: 400,
            flexShrink: 0,
            background: 'var(--t-bg-surface)',
            borderRight: '1px solid var(--t-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* ── SETTINGS ── */}
          {dockSection === 'settings' && (
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
              {!selectedApp ? (
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--t-text-muted)',
                    padding: '10px 14px',
                    fontStyle: 'italic',
                  }}
                >
                  Select an app first
                </p>
              ) : (
                <>
                  <SectionHeader label={selectedApp.name} />
                  <ActionRow
                    icon={
                      <TestTube
                        size={20}
                        weight={
                          view.type === 'settings' && (view.section === 'tests' || !view.section)
                            ? 'fill'
                            : 'regular'
                        }
                      />
                    }
                    label="Tests"
                    active={view.type === 'settings' && (view.section === 'tests' || !view.section)}
                    onClick={() =>
                      onNavigate({ type: 'settings', appId: selectedApp.id, section: 'tests' })
                    }
                  />
                  <ActionRow
                    icon={
                      <Users
                        size={20}
                        weight={
                          view.type === 'settings' && view.section === 'members'
                            ? 'fill'
                            : 'regular'
                        }
                      />
                    }
                    label="Members"
                    active={view.type === 'settings' && view.section === 'members'}
                    onClick={() =>
                      onNavigate({ type: 'settings', appId: selectedApp.id, section: 'members' })
                    }
                  />
                </>
              )}
            </div>
          )}

          {/* ── USERS ── */}
          {dockSection === 'users' && (
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
              <SectionHeader label="User Management" />
              <ActionRow
                icon={
                  <Users
                    size={20}
                    weight={
                      view.type === 'users' && (view.section === 'users' || !view.section)
                        ? 'fill'
                        : 'regular'
                    }
                  />
                }
                label="Users"
                active={view.type === 'users' && (view.section === 'users' || !view.section)}
                onClick={() => onNavigate({ type: 'users', section: 'users' })}
              />
              <ActionRow
                icon={
                  <UsersThree
                    size={20}
                    weight={
                      view.type === 'users' && view.section === 'user-groups' ? 'fill' : 'regular'
                    }
                  />
                }
                label="User Groups"
                active={view.type === 'users' && view.section === 'user-groups'}
                onClick={() => onNavigate({ type: 'users', section: 'user-groups' })}
              />
            </div>
          )}

          {/* ── RUNS ── */}
          {dockSection === 'runs' &&
            (!selectedApp ? (
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--t-text-muted)',
                    padding: '10px 14px',
                    fontStyle: 'italic',
                  }}
                >
                  Select an app first
                </p>
              </div>
            ) : (
              <>
                {/* Fixed header */}
                <div style={{ flexShrink: 0 }}>
                  <SectionHeader
                    label="Runs"
                    onAdd={() => {
                      setRunName('')
                      setRunEnv('')
                      setAddRunOpen(true)
                    }}
                  />
                  <SearchBox value={runSearch} onChange={setRunSearch} placeholder="Search runs…" />
                </div>
                {/* Scrollable list */}
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
                  {runs.length === 0 && (
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-muted)',
                        padding: '6px 14px',
                        fontStyle: 'italic',
                      }}
                    >
                      No runs yet
                    </p>
                  )}
                  {(() => {
                    const filteredRuns = runSearch.trim()
                      ? runs.filter((r) => r.name.toLowerCase().includes(runSearch.toLowerCase()))
                      : runs
                    if (runs.length > 0 && filteredRuns.length === 0)
                      return (
                        <p
                          style={{
                            fontSize: 11,
                            color: 'var(--t-text-muted)',
                            padding: '6px 14px',
                            fontStyle: 'italic',
                          }}
                        >
                          No runs match &ldquo;{runSearch}&rdquo;
                        </p>
                      )
                    return filteredRuns.map((run) => {
                      const active = view.type === 'run-execution' && view.runId === run.id
                      const statusColor =
                        run.status === 'passed'
                          ? '#3fb950'
                          : run.status === 'failed'
                            ? '#f85149'
                            : run.status === 'running'
                              ? '#d29922'
                              : 'var(--t-text-muted)'
                      const subtitle = [
                        selectedApp.name,
                        run.testCount != null
                          ? `${run.testCount} test${run.testCount !== 1 ? 's' : ''}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                      return (
                        <div
                          key={run.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 4px 6px 12px',
                            borderRadius: 6,
                            margin: '1px 6px',
                            cursor: 'pointer',
                            background: active
                              ? 'var(--t-sidebar-hover)'
                              : hoveredRunId === run.id
                                ? 'var(--t-sidebar-hover)'
                                : 'transparent',
                            userSelect: 'none',
                          }}
                          onMouseEnter={() => setHoveredRunId(run.id)}
                          onMouseLeave={() => setHoveredRunId(null)}
                          onClick={() =>
                            onNavigate({
                              type: 'run-execution',
                              appId: selectedApp.id,
                              runId: run.id,
                            })
                          }
                        >
                          <Play
                            size={17}
                            weight="fill"
                            color={statusColor}
                            style={{ flexShrink: 0, alignSelf: 'center' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                color: active ? 'var(--t-text-primary)' : 'var(--t-text-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontWeight: active ? 500 : 400,
                              }}
                            >
                              {run.name}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: 'var(--t-text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginTop: 1,
                              }}
                            >
                              {subtitle}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 9,
                              color: statusColor,
                              background: 'var(--t-bg-elevated)',
                              border: `1px solid var(--t-border-default)`,
                              borderRadius: 4,
                              padding: '1px 4px',
                              textTransform: 'uppercase',
                              flexShrink: 0,
                            }}
                          >
                            {run.status}
                          </span>
                          <div onClick={(e) => e.stopPropagation()}>
                            <RowMenu
                              size={24}
                              alwaysVisible={hoveredRunId === run.id}
                              items={[
                                {
                                  label: 'Duplicate run',
                                  icon: <CopySimple size={13} />,
                                  action: () => onDuplicateRun(run.id),
                                },
                                {
                                  label: 'Delete run',
                                  icon: <Trash size={13} />,
                                  action: () =>
                                    setConfirmTarget({ kind: 'run', id: run.id, name: run.name }),
                                  destructive: true,
                                  separator: true,
                                },
                              ]}
                            />
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </>
            ))}

          {/* ── NAV: Apps ── */}
          {dockSection === 'nav' && navLevel === 'apps' && (
            <>
              <div style={{ flexShrink: 0 }}>
                <SectionHeader
                  label="Apps"
                  onAdd={() => {
                    setAppName('')
                    setAppDesc('')
                    setAddAppOpen(true)
                  }}
                />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
                {apps.length === 0 ? (
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--t-text-muted)',
                      padding: '6px 14px',
                      fontStyle: 'italic',
                    }}
                  >
                    No apps yet
                  </p>
                ) : (
                  apps.map((app) => (
                    <ActionRow
                      key={app.id}
                      icon={
                        <SquaresFour
                          size={20}
                          weight={selectedApp?.id === app.id ? 'fill' : 'regular'}
                        />
                      }
                      label={app.name}
                      active={selectedApp?.id === app.id}
                      chevron
                      onClick={() => onNavigate({ type: 'spaces', appId: app.id })}
                      onRename={() => openRenameApp(app.id, app.name, app.description ?? null)}
                      onDelete={() => setConfirmTarget({ kind: 'app', id: app.id, name: app.name })}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* ── NAV: Spaces ── */}
          {dockSection === 'nav' && navLevel === 'spaces' && selectedApp && (
            <>
              {/* Fixed header */}
              <div style={{ flexShrink: 0 }}>
                <SectionHeader
                  label="Spaces"
                  onAdd={() => {
                    setSpaceName('')
                    setSpaceDesc('')
                    setAddSpaceOpen(true)
                  }}
                />
                <SearchBox
                  value={spaceSearch}
                  onChange={setSpaceSearch}
                  placeholder="Search spaces…"
                />
              </div>
              {/* Scrollable list */}
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
                {spaces.length === 0 ? (
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--t-text-muted)',
                      padding: '6px 14px',
                      fontStyle: 'italic',
                    }}
                  >
                    No spaces yet
                  </p>
                ) : (
                  (() => {
                    const filtered = spaceSearch.trim()
                      ? spaces.filter((s) =>
                          s.name.toLowerCase().includes(spaceSearch.toLowerCase())
                        )
                      : spaces
                    if (filtered.length === 0)
                      return (
                        <p
                          style={{
                            fontSize: 12,
                            color: 'var(--t-text-muted)',
                            padding: '6px 14px',
                            fontStyle: 'italic',
                          }}
                        >
                          No spaces match &ldquo;{spaceSearch}&rdquo;
                        </p>
                      )
                    return filtered.map((space) => {
                      const parts: string[] = []
                      if ((space.folderCount ?? 0) > 0)
                        parts.push(
                          `${space.folderCount} folder${space.folderCount !== 1 ? 's' : ''}`
                        )
                      if ((space.testCount ?? 0) > 0)
                        parts.push(`${space.testCount} test${space.testCount !== 1 ? 's' : ''}`)
                      return (
                        <ActionRow
                          key={space.id}
                          icon={
                            <Cube
                              size={20}
                              weight={activeSpaceId === space.id ? 'fill' : 'regular'}
                            />
                          }
                          label={space.name}
                          subtitle={parts.length > 0 ? parts.join(' · ') : undefined}
                          active={activeSpaceId === space.id}
                          chevron
                          onClick={() =>
                            onNavigate({ type: 'tests', appId: selectedApp.id, spaceId: space.id })
                          }
                          onRename={() =>
                            openRenameSpace(space.id, space.name, space.description ?? null)
                          }
                          onDelete={() =>
                            setConfirmTarget({ kind: 'space', id: space.id, name: space.name })
                          }
                        />
                      )
                    })
                  })()
                )}
              </div>
            </>
          )}

          {/* ── NAV: Folders ── */}
          {dockSection === 'nav' && navLevel === 'folders' && selectedApp && activeSpace && (
            <>
              {/* Fixed header */}
              <div style={{ flexShrink: 0 }}>
                <SectionHeader
                  label="Folders"
                  onAdd={() => {
                    setFolderName('')
                    setAddFolderParentId(undefined)
                    setAddFolderOpen(true)
                  }}
                  extraActions={
                    folderTree.length > 0 ? (
                      <SectionHeaderIconBtn
                        title={
                          collapsedFolderIds.size === 0
                            ? 'Collapse all folders'
                            : 'Expand all folders'
                        }
                        onClick={
                          collapsedFolderIds.size === 0 ? handleCollapseAll : handleExpandAll
                        }
                      >
                        {collapsedFolderIds.size === 0 ? (
                          <ArrowsInSimple size={11} />
                        ) : (
                          <ArrowsOutSimple size={11} />
                        )}
                      </SectionHeaderIconBtn>
                    ) : undefined
                  }
                />
                <SearchBox
                  value={folderSearch}
                  onChange={setFolderSearch}
                  placeholder="Search folders…"
                />
              </div>
              {/* Scrollable list */}
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
                {folderTree.length === 0 ? (
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--t-text-muted)',
                      padding: '6px 14px',
                      fontStyle: 'italic',
                    }}
                  >
                    No folders yet
                  </p>
                ) : folderSearch.trim() ? (
                  flatFolderResults.length === 0 ? (
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--t-text-muted)',
                        padding: '6px 14px',
                        fontStyle: 'italic',
                      }}
                    >
                      No folders match &ldquo;{folderSearch}&rdquo;
                    </p>
                  ) : (
                    flatFolderResults.map(({ node, path }) => (
                      <div
                        key={node.id}
                        onClick={() =>
                          onNavigate({
                            type: 'tests',
                            appId: selectedApp.id,
                            spaceId: activeSpace.id,
                            folderId: node.id,
                          })
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '5px 12px',
                          margin: '1px 6px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background:
                            'folderId' in view && view.folderId === node.id
                              ? 'var(--t-sidebar-hover)'
                              : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLElement).style.background =
                            'var(--t-sidebar-hover)'
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLElement).style.background =
                            'folderId' in view && view.folderId === node.id
                              ? 'var(--t-sidebar-hover)'
                              : 'transparent'
                        }}
                      >
                        <FolderSimple
                          size={14}
                          style={{ color: 'var(--t-text-muted)', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--t-text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {node.name}
                          </div>
                          {path !== node.name && (
                            <div
                              style={{
                                fontSize: 10,
                                color: 'var(--t-text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginTop: 1,
                              }}
                            >
                              {path}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  <FolderTreeWithActions
                    nodes={folderTree}
                    spaceId={activeSpace.id}
                    appId={selectedApp.id}
                    depth={0}
                    view={view}
                    collapsedIds={collapsedFolderIds}
                    onNavigate={onNavigate}
                    onAddSubfolder={openAddSubfolder}
                    onDeleteFolder={(id, name) => setConfirmTarget({ kind: 'folder', id, name })}
                    onRenameFolder={(id, name) => {
                      const node = folderTree
                        .flatMap(function flat(n): FolderNode[] {
                          return [n, ...n.children.flatMap(flat)]
                        })
                        .find((n) => n.id === id)
                      openRenameFolder(id, name, node?.description)
                    }}
                    onToggleCollapse={handleToggleCollapse}
                    onCopyFolder={handleCopyFolder}
                    onCutFolder={handleCutFolder}
                    onDuplicateFolder={handleDuplicateFolder}
                    onPasteFolder={handlePasteFolder}
                    clipboardFolderActive={clipboardFolderActive}
                    invalidPasteFolderIds={invalidPasteFolderIds}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}

      <Dialog open={addAppOpen} onOpenChange={setAddAppOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create App</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleAddApp}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>
                Name <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
              </Label>
              <Input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="My Application"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>Description</Label>
              <Input
                value={appDesc}
                onChange={(e) => setAppDesc(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <DialogFooter style={{ marginTop: 8 }}>
              <Button type="button" variant="outline" onClick={() => setAddAppOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <Plus size={13} /> {saving ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addSpaceOpen} onOpenChange={setAddSpaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Space</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleAddSpace}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>
                Name <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
              </Label>
              <Input
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                placeholder="e.g. Web App"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>Description</Label>
              <Input
                value={spaceDesc}
                onChange={(e) => setSpaceDesc(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <DialogFooter style={{ marginTop: 8 }}>
              <Button type="button" variant="outline" onClick={() => setAddSpaceOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <Plus size={13} /> {saving ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addFolderOpen}
        onOpenChange={(v) => {
          if (!v) {
            setFolderName('')
            setFolderDesc('')
          }
          setAddFolderOpen(v)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {addFolderParentId !== undefined ? 'Create Subfolder' : 'Create Folder'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleAddFolder}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>
                Name <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
              </Label>
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. Login flows"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>Description</Label>
              <Input
                value={folderDesc}
                onChange={(e) => setFolderDesc(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <DialogFooter style={{ marginTop: 8 }}>
              <Button type="button" variant="outline" onClick={() => setAddFolderOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <Plus size={13} /> {saving ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addRunOpen} onOpenChange={setAddRunOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Run</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!runName.trim()) return
              setSaving(true)
              try {
                const run = await onCreateRun({
                  name: runName.trim(),
                  environment: runEnv.trim() || undefined,
                })
                setRunName('')
                setRunEnv('')
                setAddRunOpen(false)
                if (run && selectedApp) {
                  onNavigate({ type: 'run-execution', appId: selectedApp.id, runId: run.id })
                }
              } finally {
                setSaving(false)
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>
                Name <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
              </Label>
              <Input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder="e.g. Sprint 12 Smoke"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>Environment</Label>
              <Input
                value={runEnv}
                onChange={(e) => setRunEnv(e.target.value)}
                placeholder="e.g. staging"
              />
            </div>
            <DialogFooter style={{ marginTop: 8 }}>
              <Button type="button" variant="outline" onClick={() => setAddRunOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !runName.trim()}>
                <Plus size={13} /> {saving ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmTarget !== null}
        title={`Delete ${confirmTarget?.kind ?? ''}`}
        description={
          confirmTarget?.kind === 'app'
            ? `"${confirmTarget.name}" and all its spaces, folders, and tests will be permanently deleted.`
            : confirmTarget?.kind === 'space'
              ? `"${confirmTarget?.name}" and all its folders and tests will be permanently deleted.`
              : confirmTarget?.kind === 'run'
                ? `"${confirmTarget?.name}" and all its test results will be permanently deleted.`
                : `"${confirmTarget?.name}" and all its tests will be permanently deleted.`
        }
        confirmLabel={
          confirmTarget?.kind === 'app'
            ? 'Delete App'
            : confirmTarget?.kind === 'space'
              ? 'Delete Space'
              : confirmTarget?.kind === 'run'
                ? 'Delete Run'
                : 'Delete Folder'
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />

      {/* ── Rename dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rename{' '}
              {renameTarget?.kind === 'app'
                ? 'App'
                : renameTarget?.kind === 'space'
                  ? 'Space'
                  : 'Folder'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleRename}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>
                Name <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
              </Label>
              <Input
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder={renameTarget?.currentName}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>Description</Label>
              <Input
                value={renameDesc}
                onChange={(e) => setRenameDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            {/* ── Space-level Tags ── */}
            {renameTarget?.kind === 'space' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Tag size={13} style={{ color: 'var(--t-text-muted)' }} />
                  <Label style={{ margin: 0 }}>Space Tags</Label>
                </div>

                {/* Existing space tags */}
                {spaceTagList.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {spaceTagList.map((t) => (
                      <div
                        key={t.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      >
                        <TagPill name={t.name} color={t.color} size="sm" />
                        <button
                          type="button"
                          title="Remove tag"
                          onClick={async () => {
                            if (!renameTarget) return
                            await api.spaceTags.delete(renameTarget.id, t.id).catch(() => {})
                            setSpaceTagList((prev) => prev.filter((x) => x.id !== t.id))
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--t-text-muted)',
                            padding: 2,
                            display: 'flex',
                            borderRadius: 3,
                            lineHeight: 1,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--t-accent-danger)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--t-text-muted)'
                          }}
                        >
                          <X size={9} weight="bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new space tag */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={newSpaceTagColor}
                    onChange={(e) => setNewSpaceTagColor(e.target.value)}
                    title="Tag color"
                    style={{
                      width: 30,
                      height: 30,
                      padding: 2,
                      borderRadius: 6,
                      border: '1px solid var(--t-border-default)',
                      background: 'var(--t-bg-elevated)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                  <Input
                    value={newSpaceTagName}
                    onChange={(e) => {
                      setNewSpaceTagName(e.target.value)
                      setSpaceTagError('')
                    }}
                    onKeyDown={async (e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      if (!newSpaceTagName.trim() || !renameTarget || spaceTagCreating) return
                      const trimmed = newSpaceTagName.trim()
                      if (
                        spaceTagList.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())
                      ) {
                        setSpaceTagError('A tag with this name already exists in this space')
                        return
                      }
                      setSpaceTagCreating(true)
                      setSpaceTagError('')
                      try {
                        const created = await api.spaceTags.create(renameTarget.id, {
                          name: trimmed,
                          color: newSpaceTagColor,
                        })
                        setSpaceTagList((prev) =>
                          prev.some((x) => x.id === created.id) ? prev : [...prev, created]
                        )
                        setNewSpaceTagName('')
                      } catch (err) {
                        setSpaceTagError((err as Error).message)
                      } finally {
                        setSpaceTagCreating(false)
                      }
                    }}
                    placeholder="Tag name… (Enter to add)"
                    style={{ flex: 1, fontSize: 12 }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!newSpaceTagName.trim() || spaceTagCreating}
                    onClick={async () => {
                      if (!newSpaceTagName.trim() || !renameTarget || spaceTagCreating) return
                      const trimmed = newSpaceTagName.trim()
                      if (
                        spaceTagList.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())
                      ) {
                        setSpaceTagError('A tag with this name already exists in this space')
                        return
                      }
                      setSpaceTagCreating(true)
                      setSpaceTagError('')
                      try {
                        const created = await api.spaceTags.create(renameTarget.id, {
                          name: trimmed,
                          color: newSpaceTagColor,
                        })
                        setSpaceTagList((prev) =>
                          prev.some((x) => x.id === created.id) ? prev : [...prev, created]
                        )
                        setNewSpaceTagName('')
                      } catch (err) {
                        setSpaceTagError((err as Error).message)
                      } finally {
                        setSpaceTagCreating(false)
                      }
                    }}
                    style={{ gap: 4, flexShrink: 0 }}
                  >
                    <Plus size={12} /> Add
                  </Button>
                </div>
                {spaceTagError && (
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--t-accent-danger)' }}>
                    {spaceTagError}
                  </p>
                )}
                {globalTagList.length > 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--t-text-muted)' }}>
                    Global tags are available in all spaces automatically. Space tags cannot share a
                    name with a global tag.
                  </p>
                )}
              </div>
            )}

            <DialogFooter style={{ marginTop: 8 }}>
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  saving ||
                  !renameName.trim() ||
                  (renameName.trim() === renameTarget?.currentName &&
                    renameDesc.trim() ===
                      ((renameTarget as { currentDescription?: string | null })
                        ?.currentDescription ?? ''))
                }
              >
                <PencilSimple size={13} /> {saving ? 'Saving…' : 'Rename'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* intentionally empty — DB / Cache / Auth Config dialogs live in AdminSettingsView */}
      {(false as const) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setDbDialogOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 12,
              padding: 28,
              width: 480,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div>
              <h2
                style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--t-text-primary)' }}
              >
                Database Connection
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t-text-muted)' }}>
                Switch between SQLite (local), Turso (cloud), or PostgreSQL.
              </p>
            </div>

            {/* Type selector cards */}
            <div style={{ display: 'flex', gap: 8 }}>
              {(['sqlite', 'turso', 'postgres'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setDbType(t)
                    setDbStatus(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: dbType === t ? '1px solid rgba(255,255,255,0.25)' : '1px solid #222',
                    background: dbType === t ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: dbType === t ? '#ededed' : '#666',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.12s',
                    position: 'relative',
                  }}
                >
                  <Database size={18} weight={dbType === t ? 'fill' : 'regular'} />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>
                    {t === 'sqlite' ? 'SQLite' : t === 'turso' ? 'Turso' : 'PostgreSQL'}
                  </span>
                  {currentDbType === t && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--t-accent-success, #22c55e)',
                      }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* URL / config fields */}
            {dbType === 'sqlite' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>Storage</Label>
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--t-bg-surface)',
                    border: '1px solid var(--t-border-default)',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'var(--t-text-muted)',
                    fontFamily: 'monospace',
                  }}
                >
                  file: noob-sdet.db (local)
                </div>
              </div>
            )}

            {dbType === 'turso' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Database URL <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
                  </Label>
                  <Input
                    value={dbUrl}
                    onChange={(e) => {
                      setDbUrl(e.target.value)
                      setDbStatus(null)
                    }}
                    placeholder="libsql://your-db.turso.io"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Auth Token
                  </Label>
                  <Input
                    type="password"
                    value={dbToken}
                    onChange={(e) => {
                      setDbToken(e.target.value)
                      setDbStatus(null)
                    }}
                    placeholder="eyJ… (leave blank if none)"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                </div>
              </div>
            )}

            {dbType === 'postgres' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Connection String{' '}
                    <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
                  </Label>
                  <Input
                    value={dbUrl}
                    onChange={(e) => {
                      setDbUrl(e.target.value)
                      setDbStatus(null)
                    }}
                    placeholder="postgresql://user:pass@host:5432/db"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>
                    Supports Neon, Supabase, RDS, Aurora, and self-hosted PostgreSQL.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Max Pool Connections
                  </Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={dbPoolMax}
                      onChange={(e) => {
                        setDbPoolMax(e.target.value)
                        setDbStatus(null)
                      }}
                      style={{ width: 80, fontFamily: 'monospace', fontSize: 13 }}
                    />
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--t-text-muted)' }}>
                      Connections kept alive in the pool (default 10, max 100). Raise if you have
                      many concurrent users.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Status banner */}
            {dbStatus && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: dbStatus.ok ? 'rgba(34,197,94,0.08)' : 'rgba(229,72,77,0.08)',
                  border: `1px solid ${dbStatus.ok ? 'rgba(34,197,94,0.2)' : 'rgba(229,72,77,0.2)'}`,
                  fontSize: 13,
                  color: dbStatus.ok ? '#22c55e' : '#e5484d',
                }}
              >
                {dbStatus.ok ? (
                  <CheckCircle size={15} weight="fill" />
                ) : (
                  <Warning size={15} weight="fill" />
                )}
                {dbStatus.message}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setDbDialogOpen(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                disabled={dbLoading || (dbType !== 'sqlite' && !dbUrl.trim())}
                onClick={handleDbTest}
              >
                {dbLoading ? 'Testing…' : 'Test Connection'}
              </Button>
              <Button
                disabled={dbLoading || (dbType !== 'sqlite' && !dbUrl.trim())}
                onClick={handleDbSave}
              >
                {dbLoading ? 'Saving…' : 'Save & Apply'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* intentionally deleted — cache dialog lives in AdminSettingsView */}
      {(false as const) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setCacheDialogOpen(false)}
        >
          <div
            style={{
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 12,
              padding: 24,
              width: 420,
              maxWidth: '90vw',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div>
              <h2
                style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--t-text-primary)' }}
              >
                Cache Settings
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t-text-muted)' }}>
                None (always fresh), LRU (single-server), or Redis (multi-server).
              </p>
            </div>

            {/* Type selector */}
            <div style={{ display: 'flex', gap: 8 }}>
              {(['none', 'lru', 'redis'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setCacheType(t)
                    setCacheStatus(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 4px',
                    borderRadius: 8,
                    border: cacheType === t ? '1px solid rgba(255,255,255,0.25)' : '1px solid #222',
                    background: cacheType === t ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: cacheType === t ? '#ededed' : '#666',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    position: 'relative',
                  }}
                >
                  <Lightning size={18} weight={cacheType === t ? 'fill' : 'regular'} />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>
                    {t === 'none' ? 'None' : t === 'lru' ? 'LRU' : 'Redis'}
                  </span>
                  {currentCacheType === t && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--t-accent-success, #22c55e)',
                      }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* None description */}
            {cacheType === 'none' && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text-muted)' }}>
                Every request goes directly to the database. No stale data, no setup required.
              </p>
            )}

            {/* LRU options */}
            {cacheType === 'lru' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Max Entries
                  </Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Input
                      type="number"
                      min={10}
                      max={10000}
                      value={cacheLruMax}
                      onChange={(e) => {
                        setCacheLruMax(e.target.value)
                        setCacheStatus(null)
                      }}
                      style={{ width: 90, fontFamily: 'monospace', fontSize: 13 }}
                    />
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--t-text-muted)' }}>
                      Max cached items (default 500). Oldest items are evicted when full.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    TTL (seconds)
                  </Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Input
                      type="number"
                      min={1}
                      max={3600}
                      value={cacheTtl}
                      onChange={(e) => {
                        setCacheTtl(e.target.value)
                        setCacheStatus(null)
                      }}
                      style={{ width: 90, fontFamily: 'monospace', fontSize: 13 }}
                    />
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--t-text-muted)' }}>
                      How long entries stay fresh (default 30 s).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Redis options */}
            {cacheType === 'redis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Redis URL <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
                  </Label>
                  <Input
                    value={cacheRedisUrl}
                    onChange={(e) => {
                      setCacheRedisUrl(e.target.value)
                      setCacheStatus(null)
                    }}
                    placeholder="redis://localhost:6379"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>
                    Supports local Redis, Upstash, Valkey, and self-hosted instances.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    TTL (seconds)
                  </Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Input
                      type="number"
                      min={1}
                      max={3600}
                      value={cacheTtl}
                      onChange={(e) => {
                        setCacheTtl(e.target.value)
                        setCacheStatus(null)
                      }}
                      style={{ width: 90, fontFamily: 'monospace', fontSize: 13 }}
                    />
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--t-text-muted)' }}>
                      How long entries stay fresh (default 30 s).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Status banner */}
            {cacheStatus && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: cacheStatus.ok ? 'rgba(34,197,94,0.08)' : 'rgba(229,72,77,0.08)',
                  border: `1px solid ${cacheStatus.ok ? 'rgba(34,197,94,0.2)' : 'rgba(229,72,77,0.2)'}`,
                  fontSize: 13,
                  color: cacheStatus.ok ? '#22c55e' : '#e5484d',
                }}
              >
                {cacheStatus.ok ? (
                  <CheckCircle size={15} weight="fill" />
                ) : (
                  <Warning size={15} weight="fill" />
                )}
                {cacheStatus.message}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setCacheDialogOpen(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                disabled={cacheLoading || (cacheType === 'redis' && !cacheRedisUrl.trim())}
                onClick={handleCacheTest}
              >
                {cacheLoading ? 'Testing…' : 'Test Connection'}
              </Button>
              <Button
                disabled={cacheLoading || (cacheType === 'redis' && !cacheRedisUrl.trim())}
                onClick={handleCacheSave}
              >
                {cacheLoading ? 'Saving…' : 'Save & Apply'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
