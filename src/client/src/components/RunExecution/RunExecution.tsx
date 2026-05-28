import React, { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Hand,
  ArrowLeft,
  Play,
  StopCircle,
  CaretDown,
  CaretRight,
  Plus,
  FolderOpen,
  Cube,
  FolderSimple,
  TestTube,
  CircleNotch,
  ArrowCounterClockwise,
  DotsThreeVertical,
  ArrowSquareOut,
  Trash,
  X,
  Check,
  CheckCircle,
  XCircle,
  Minus,
  WarningCircle,
  ArrowCircleRight,
  Prohibit,
  Funnel,
  ArrowsDownUp,
} from '@phosphor-icons/react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button.js'
import { Separator } from '@/components/ui/separator.js'
import { ConfirmDialog } from '@/components/ui/confirm-dialog.js'
import { cn } from '@/lib/utils.js'
import { api } from '../../lib/api.js'
import type {
  TestRun,
  RunResult,
  RunReport,
  View,
  Space,
  Folder,
  FolderNode,
  Test,
} from '../../types/index.js'

interface Props {
  run: TestRun | null
  results: RunResult[]
  report: RunReport | null
  loading: boolean
  appId: number
  spaces: Space[]
  onNavigate: (v: View) => void
  onMarkResult: (
    resultId: number,
    status: 'pass' | 'fail' | 'skip' | 'blocked',
    opts?: { propagateToSteps?: boolean }
  ) => Promise<void>
  onSetRunStatus: (status: string) => Promise<void>
  onRefreshResults: () => Promise<void>
}

// ─── Vercel-palette design tokens (no blue / violet / indigo) ────────────────
const STATUS_DOT: Record<string, string> = {
  pending: 'var(--t-border-strong)',
  pass: '#22c55e',
  fail: '#ef4444',
  skip: '#f59e0b',
  blocked: '#f97316',
}
const STATUS_TEXT: Record<string, string> = {
  pending: 'var(--t-text-muted)',
  pass: '#22c55e',
  fail: '#ef4444',
  skip: '#f59e0b',
  blocked: '#f97316',
}
const RUN_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-secondary text-muted-foreground border-border',
  running: 'bg-secondary text-yellow border-border',
  passed: 'bg-green/10 text-green border-green/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  aborted: 'bg-secondary text-muted-foreground border-border',
}

// ─── Flat test list item ──────────────────────────────────────────────────────

const STATUS_ICON_ACTIVE: Record<string, React.ReactNode> = {
  pass: <Check size={14} weight="bold" />,
  fail: <X size={14} weight="bold" />,
  skip: <Minus size={14} weight="bold" />,
  blocked: <Hand size={14} weight="fill" />,
}
const STATUS_ICON_IDLE: Record<string, React.ReactNode> = {
  pass: <Check size={14} />,
  fail: <X size={14} />,
  skip: <Minus size={14} />,
  blocked: <Hand size={14} />,
}
const STATUS_ACTIVE_STYLE: Record<string, React.CSSProperties> = {
  pass: {
    color: '#22c55e',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.25)',
  },
  fail: {
    color: '#ef4444',
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.25)',
  },
  skip: {
    color: '#f59e0b',
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.25)',
  },
  blocked: {
    color: '#f97316',
    background: 'rgba(249,115,22,0.10)',
    border: '1px solid rgba(249,115,22,0.25)',
  },
}
const STATUS_TOOLTIP: Record<string, string> = {
  pass: 'Pass',
  fail: 'Fail',
  skip: 'Skip',
  blocked: 'Block',
}

const PRIORITY_COLOR: Record<string, string> = {
  low: '#6b7280',
  medium: '#d97706',
  high: '#ea580c',
  critical: '#dc2626',
}

// ─── Filter dropdown ─────────────────────────────────────────────────────────

function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen((p) => !p)
  }

  const toggle = (val: string) => {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(next)
  }

  const activeCount = selected.size
  const isActive = activeCount > 0

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 5,
          border: `1px solid ${isActive ? 'var(--t-border-strong)' : 'var(--t-border-default)'}`,
          background: isActive ? 'var(--t-bg-surface)' : 'transparent',
          color: isActive ? 'var(--t-text-primary)' : 'var(--t-text-secondary)',
          fontSize: 12,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.1s',
        }}
      >
        <Funnel size={12} weight={isActive ? 'fill' : 'regular'} />
        {label}
        {activeCount > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              background: 'var(--t-text-primary)',
              color: 'var(--t-bg-base)',
              borderRadius: 10,
              padding: '0 5px',
              lineHeight: '16px',
              minWidth: 16,
              textAlign: 'center',
            }}
          >
            {activeCount}
          </span>
        )}
      </button>
      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              zIndex: 9999,
              minWidth: 180,
              maxHeight: 260,
              overflowY: 'auto',
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 8,
              boxShadow: 'var(--t-shadow-sm)',
              padding: '4px 0',
            }}
          >
            {options.length === 0 ? (
              <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--t-text-muted)' }}>
                No options
              </div>
            ) : (
              <>
                {options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => toggle(opt)}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--t-sidebar-hover)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 14px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--t-text-primary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: selected.has(opt)
                          ? '1.5px solid var(--t-text-primary)'
                          : '1.5px solid var(--t-border-strong)',
                        background: selected.has(opt) ? 'var(--t-text-primary)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.1s',
                      }}
                    >
                      {selected.has(opt) && (
                        <Check size={9} weight="bold" color="var(--t-bg-base)" />
                      )}
                    </div>
                    {opt}
                  </button>
                ))}
                {activeCount > 0 && (
                  <>
                    <div
                      style={{ height: 1, background: 'var(--t-border-subtle)', margin: '3px 0' }}
                    />
                    <button
                      onClick={() => {
                        onChange(new Set())
                        setOpen(false)
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--t-sidebar-hover)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 14px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--t-text-muted)',
                        fontSize: 11,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      Clear filter
                    </button>
                  </>
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

// ─── Ring-style status icon ───────────────────────────────────────────────────

function StatusRingIcon({ status, size = 22 }: { status: string; size?: number }) {
  // pass — green check-circle
  if (status === 'pass') {
    return <CheckCircle size={size} weight="fill" color="#22c55e" style={{ flexShrink: 0 }} />
  }
  // fail — red warning circle (exclamation)
  if (status === 'fail') {
    return <WarningCircle size={size} weight="fill" color="#ef4444" style={{ flexShrink: 0 }} />
  }
  // skip — amber forward-arrow circle
  if (status === 'skip') {
    return <ArrowCircleRight size={size} weight="fill" color="#f59e0b" style={{ flexShrink: 0 }} />
  }
  // blocked — orange prohibition circle
  if (status === 'blocked') {
    return <Prohibit size={size} weight="fill" color="#f97316" style={{ flexShrink: 0 }} />
  }

  // pending — dashed SVG ring, rendered slightly smaller than filled icons
  const ringSize = Math.max(8, size - 6)
  const sw = Math.max(1.5, ringSize * 0.08)
  const r = (ringSize - sw * 2) / 2
  const dashLen = Math.max(2, r * 0.6)
  const gapLen = Math.max(1.5, r * 0.3)
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={r}
          fill="none"
          stroke="var(--t-border-strong)"
          strokeWidth={sw}
          strokeDasharray={`${dashLen} ${gapLen}`}
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function TestRow({
  result,
  isSelected,
  isChecked,
  bulkMode,
  onSelect,
  onToggleCheck,
  onMarkResult,
  onRemove,
  onResetResult,
  onGoToSource,
}: {
  result: RunResult
  isSelected: boolean
  isChecked: boolean
  bulkMode: boolean
  onSelect: () => void
  onToggleCheck: (e: React.MouseEvent) => void
  onMarkResult: Props['onMarkResult']
  onRemove: () => void
  onResetResult: () => Promise<void>
  onGoToSource: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const dotBtnRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        dotBtnRef.current &&
        !dotBtnRef.current.contains(e.target as Node)
      )
        setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const openMenu = () => {
    if (dotBtnRef.current) {
      const r = dotBtnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setMenuOpen((p) => !p)
  }

  const accentColor = isSelected
    ? result.status === 'pending'
      ? 'var(--t-border-strong)'
      : (STATUS_DOT[result.status] ?? 'var(--t-border-strong)')
    : result.status === 'pending'
      ? 'transparent'
      : (STATUS_DOT[result.status] ?? 'transparent')

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px 6px 14px',
        borderBottom: '1px solid var(--t-border-subtle)',
        background: isSelected || hovered ? 'var(--t-bg-hover)' : 'transparent',
        transition: 'background 0.1s',
        cursor: 'pointer',
        borderLeft: `2px solid ${accentColor}`,
      }}
    >
      {/* Bulk checkbox — visible on hover, when checked, or when bulk mode is active */}
      <div
        onClick={(e) => {
          e.stopPropagation()
          onToggleCheck(e)
        }}
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          borderRadius: 4,
          border: isChecked
            ? '1.5px solid var(--t-text-primary)'
            : '1.5px solid var(--t-border-strong)',
          background: isChecked ? 'var(--t-text-primary)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.1s',
          opacity: hovered || isChecked || bulkMode ? 1 : 0,
          pointerEvents: hovered || isChecked || bulkMode ? 'auto' : 'none',
        }}
      >
        {isChecked && <Check size={10} weight="bold" color="var(--t-bg-base)" />}
      </div>

      {/* Status ring icon */}
      <StatusRingIcon status={result.status} />

      {/* Title + sub-text */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 13,
            color:
              result.status === 'pending' ? 'var(--t-text-secondary)' : 'var(--t-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}
        >
          {result.testTitle || `Test #${result.testId}`}
        </span>
        {/* Sub-text row: internalId · priority · tags · category */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginTop: 2,
            flexWrap: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {result.internalId && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--t-text-muted)',
                flexShrink: 0,
              }}
            >
              {result.internalId}
            </span>
          )}
          {result.internalId && (
            <span style={{ fontSize: 9, color: 'var(--t-border-default)', flexShrink: 0 }}>·</span>
          )}
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: PRIORITY_COLOR[result.priority] ?? 'var(--t-text-muted)',
              flexShrink: 0,
            }}
          >
            {result.priority}
          </span>
          {(() => {
            const tagList: string[] = result.tags
              ? (() => {
                  try {
                    return JSON.parse(result.tags) as string[]
                  } catch {
                    return []
                  }
                })()
              : []
            if (tagList.length === 0) return null
            return (
              <>
                <span style={{ fontSize: 9, color: 'var(--t-border-default)', flexShrink: 0 }}>
                  ·
                </span>
                {tagList.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      color: 'var(--t-text-muted)',
                      background: 'var(--t-bg-elevated)',
                      border: '1px solid var(--t-border-subtle)',
                      borderRadius: 3,
                      padding: '0 4px',
                      flexShrink: 0,
                      lineHeight: '14px',
                    }}
                  >
                    {tag}
                  </span>
                ))}
                {tagList.length > 3 && (
                  <span style={{ fontSize: 9, color: 'var(--t-text-muted)', flexShrink: 0 }}>
                    +{tagList.length - 3}
                  </span>
                )}
              </>
            )
          })()}
          {result.category && (
            <>
              <span style={{ fontSize: 9, color: 'var(--t-border-default)', flexShrink: 0 }}>
                ·
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--t-text-muted)',
                  flexShrink: 0,
                }}
              >
                {result.category}
              </span>
            </>
          )}
        </div>
      </div>

      {result.executedBy && (
        <span style={{ fontSize: 11, color: 'var(--t-text-muted)', flexShrink: 0 }}>
          {result.executedBy}
        </span>
      )}

      {/* Icon status buttons — visible only on row hover */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.1s',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(['pass', 'fail', 'skip', 'blocked'] as const).map((s) => {
          const isActive = result.status === s
          const hoverColor = STATUS_ACTIVE_STYLE[s].color as string
          return (
            <button
              key={s}
              title={STATUS_TOOLTIP[s]}
              onClick={() => onMarkResult(result.id, s, { propagateToSteps: true })}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = hoverColor
                  e.currentTarget.style.background = 'var(--t-elem-hover)'
                  e.currentTarget.style.borderColor = 'var(--t-border-default)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--t-text-muted)'
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                }
              }}
              style={{
                width: 26,
                height: 26,
                borderRadius: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.1s',
                flexShrink: 0,
                ...(isActive
                  ? STATUS_ACTIVE_STYLE[s]
                  : {
                      color: 'var(--t-text-muted)',
                      background: 'transparent',
                      border: '1px solid transparent',
                    }),
              }}
            >
              {isActive ? STATUS_ICON_ACTIVE[s] : STATUS_ICON_IDLE[s]}
            </button>
          )
        })}
      </div>

      {/* ⋮ context menu — portal so it escapes accordion overflow clipping */}
      <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <button
          ref={dotBtnRef}
          title="More options"
          onClick={openMenu}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--t-text-secondary)'
            e.currentTarget.style.background = 'var(--t-elem-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = menuOpen
              ? 'var(--t-text-secondary)'
              : 'var(--t-text-muted)'
            e.currentTarget.style.background = menuOpen ? 'var(--t-elem-hover)' : 'transparent'
          }}
          style={{
            width: 26,
            height: 26,
            borderRadius: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.1s',
            background: menuOpen ? 'var(--t-elem-hover)' : 'transparent',
            border: 'none',
            color: menuOpen ? 'var(--t-text-secondary)' : 'var(--t-text-muted)',
          }}
        >
          <DotsThreeVertical size={14} weight="bold" />
        </button>
        {menuOpen &&
          menuPos &&
          createPortal(
            <div
              ref={menuRef}
              style={{
                position: 'fixed',
                top: menuPos.top,
                right: menuPos.right,
                zIndex: 9999,
                minWidth: 175,
                background: 'var(--t-bg-panel)',
                border: '1px solid var(--t-border-default)',
                borderRadius: 8,
                boxShadow: 'var(--t-shadow-sm)',
                overflow: 'hidden',
                padding: '4px 0',
              }}
            >
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onResetResult()
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--t-sidebar-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--t-text-primary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <ArrowCounterClockwise size={13} color="var(--t-text-muted)" /> Reset test progress
              </button>
              <div style={{ height: 1, background: 'var(--t-border-subtle)', margin: '3px 0' }} />
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onGoToSource()
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--t-sidebar-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--t-text-primary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <ArrowSquareOut size={13} color="var(--t-text-muted)" /> Go to test source
              </button>
              <div style={{ height: 1, background: 'var(--t-border-subtle)', margin: '3px 0' }} />
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onRemove()
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.07)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--t-accent-danger)',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Trash size={13} color="var(--t-accent-danger)" /> Remove from run
              </button>
            </div>,
            document.body
          )}
      </div>
    </div>
  )
}

// ─── Test detail panel (right-side drawer) ────────────────────────────────────

const STEP_CIRCLE_STYLE = {
  pending: {
    bg: 'var(--t-bg-surface)',
    border: 'var(--t-border-default)',
    color: 'var(--t-text-muted)',
  },
  pass: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.28)', color: '#22c55e' },
  fail: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.28)', color: '#ef4444' },
  skip: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.28)', color: '#f59e0b' },
} as const

function TestDetailPanel({
  result,
  appId: _appId,
  runId: _runId,
  onClose,
  onMarkResult,
  onResetResult,
  onMarkStep,
}: {
  result: RunResult
  appId: number
  runId: number
  onClose: () => void
  onMarkResult: Props['onMarkResult']
  onResetResult: () => Promise<void>
  onMarkStep: (stepResultId: number, status: 'pass' | 'fail' | 'skip') => Promise<void>
}) {
  const [resetting, setResetting] = useState(false)
  const crumbs = [result.spaceName, ...(result.folderPath ?? []), result.folderName].filter(Boolean)

  return (
    <div
      style={{
        width: 580,
        flexShrink: 0,
        borderLeft: '1px solid var(--t-border-default)',
        background: 'var(--t-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--t-border-subtle)',
          flexShrink: 0,
        }}
      >
        {/* Row 1: title + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <p
            style={{
              flex: 1,
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--t-text-primary)',
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            {result.testTitle || `Test #${result.testId}`}
          </p>
          <button
            onClick={async () => {
              setResetting(true)
              try {
                await onResetResult()
              } finally {
                setResetting(false)
              }
            }}
            title="Reset test"
            style={{
              width: 28,
              height: 28,
              borderRadius: 5,
              border: '1px solid var(--t-border-default)',
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--t-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.1s',
              marginTop: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--t-text-primary)'
              e.currentTarget.style.borderColor = 'var(--t-border-strong)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--t-text-muted)'
              e.currentTarget.style.borderColor = 'var(--t-border-default)'
            }}
          >
            <ArrowCounterClockwise size={13} className={resetting ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            title="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: 5,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--t-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.1s',
              marginTop: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--t-text-primary)'
              e.currentTarget.style.background = 'var(--t-elem-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--t-text-muted)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Row 2: breadcrumb + status badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          {crumbs.length > 0 ? (
            <span
              style={{
                fontSize: 11,
                color: 'var(--t-text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {crumbs.join(' · ')}
            </span>
          ) : (
            <span />
          )}
          {/* Status badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 20,
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 600,
              background:
                result.status === 'pending'
                  ? 'var(--t-bg-elevated)'
                  : result.status === 'pass'
                    ? 'rgba(34,197,94,0.1)'
                    : result.status === 'fail'
                      ? 'rgba(239,68,68,0.1)'
                      : result.status === 'skip'
                        ? 'rgba(245,158,11,0.1)'
                        : 'rgba(249,115,22,0.1)',
              color:
                result.status === 'pending'
                  ? 'var(--t-text-muted)'
                  : result.status === 'pass'
                    ? '#22c55e'
                    : result.status === 'fail'
                      ? '#ef4444'
                      : result.status === 'skip'
                        ? '#f59e0b'
                        : '#f97316',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'currentColor',
                flexShrink: 0,
              }}
            />
            {result.status === 'pending' ? 'Pending' : STATUS_TOOLTIP[result.status]}
          </span>
        </div>
      </div>

      {/* Status action buttons */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--t-border-subtle)',
          display: 'flex',
          gap: 6,
          flexShrink: 0,
        }}
      >
        {(['pass', 'fail', 'skip', 'blocked'] as const).map((s) => {
          const isActive = result.status === s
          return (
            <button
              key={s}
              title={STATUS_TOOLTIP[s]}
              onClick={() => onMarkResult(result.id, s, { propagateToSteps: true })}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 6,
                border: '1px solid',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.12s',
                fontSize: 12,
                fontWeight: 600,
                ...(isActive
                  ? {
                      ...STATUS_ACTIVE_STYLE[s],
                      borderColor:
                        (STATUS_ACTIVE_STYLE[s].border as string)?.match(
                          /#[a-f0-9]+|rgba[^)]+\)/i
                        )?.[0] ?? 'transparent',
                    }
                  : {
                      background: 'transparent',
                      borderColor: 'var(--t-border-default)',
                      color: 'var(--t-text-secondary)',
                    }),
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = STATUS_ACTIVE_STYLE[s].color as string
                  e.currentTarget.style.borderColor = 'var(--t-border-strong)'
                  e.currentTarget.style.background = 'var(--t-row-hover)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--t-text-secondary)'
                  e.currentTarget.style.borderColor = 'var(--t-border-default)'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {isActive ? STATUS_ICON_ACTIVE[s] : STATUS_ICON_IDLE[s]}
              {STATUS_TOOLTIP[s]}
            </button>
          )
        })}
      </div>

      {/* Preconditions */}
      {result.preconditions && (
        <div
          style={{
            padding: '10px 16px 12px',
            borderBottom: '1px solid var(--t-border-subtle)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--t-text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Preconditions
          </span>
          <div
            className="rich-preview"
            dangerouslySetInnerHTML={{ __html: result.preconditions }}
            style={{ fontSize: 12, color: 'var(--t-text-secondary)', lineHeight: 1.6 }}
          />
        </div>
      )}

      {/* Steps list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {result.stepResults.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--t-text-muted)',
              fontSize: 13,
            }}
          >
            No steps defined for this test.
          </div>
        ) : (
          <>
            {/* Steps header */}
            <div
              style={{
                padding: '10px 16px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--t-text-muted)',
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Steps
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--t-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {result.stepResults.filter((s) => s.status !== 'pending').length}
                <span style={{ color: 'var(--t-border-strong)', margin: '0 3px' }}>/</span>
                {result.stepResults.length}
              </span>
            </div>
            {/* Progress bar */}
            {result.stepResults.length > 0 && (
              <div
                style={{
                  margin: '0 16px 8px',
                  height: 2,
                  background: 'var(--t-border-subtle)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: 2,
                    transition: 'width 0.4s ease',
                    background: 'var(--t-accent-success)',
                    width: `${Math.round((result.stepResults.filter((s) => s.status !== 'pending').length / result.stepResults.length) * 100)}%`,
                  }}
                />
              </div>
            )}
            {result.testType === 'bdd'
              ? (() => {
                  // Group steps by scenarioId, preserving order
                  const groups: {
                    scenarioId: number | null
                    featureName: string | null
                    scenarioName: string | null
                    steps: typeof result.stepResults
                  }[] = []
                  for (const step of result.stepResults) {
                    const sid = step.scenarioId ?? null
                    const last = groups[groups.length - 1]
                    if (!last || last.scenarioId !== sid) {
                      groups.push({
                        scenarioId: sid,
                        featureName: step.featureName ?? null,
                        scenarioName: step.scenarioName ?? null,
                        steps: [step],
                      })
                    } else {
                      last.steps.push(step)
                    }
                  }
                  // step content starts at: 16px outer padding + 26px circle + 12px gap = 54px
                  const CONTENT_OFFSET = 54
                  const shownFeatures = new Set<string>()
                  return groups.map((group) => (
                    <div key={group.scenarioId ?? 'none'} style={{ marginBottom: 4 }}>
                      {/* Feature — full-width rule + name, shown once per unique feature */}
                      {group.featureName &&
                        !shownFeatures.has(group.featureName) &&
                        (() => {
                          shownFeatures.add(group.featureName!)
                          return (
                            <div style={{ padding: '14px 16px 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: 'var(--t-text-muted)',
                                    letterSpacing: '0.07em',
                                    textTransform: 'uppercase',
                                    flexShrink: 0,
                                  }}
                                >
                                  Feature
                                </span>
                                <span
                                  style={{
                                    flex: 1,
                                    height: 1,
                                    background: 'var(--t-border-subtle)',
                                  }}
                                />
                              </div>
                              <p
                                style={{
                                  margin: '3px 0 0',
                                  fontSize: 11,
                                  color: 'var(--t-text-muted)',
                                  fontStyle: 'italic',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {group.featureName}
                              </p>
                            </div>
                          )
                        })()}
                      {/* Scenario — label aligned with step text column */}
                      <div
                        style={{
                          paddingLeft: CONTENT_OFFSET,
                          paddingRight: 16,
                          paddingTop: 10,
                          paddingBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'var(--t-text-muted)',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Scenario{' '}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--t-text-secondary)',
                            fontWeight: 500,
                          }}
                        >
                          {group.scenarioName ?? '—'}
                        </span>
                      </div>
                      {/* Steps */}
                      {group.steps.map((step, idx) => (
                        <StepRow
                          key={step.id}
                          step={step}
                          index={idx}
                          isLast={idx === group.steps.length - 1}
                          onMark={(status) => onMarkStep(step.id, status)}
                        />
                      ))}
                    </div>
                  ))
                })()
              : result.stepResults.map((step, idx) => (
                  <StepRow
                    key={step.id}
                    step={step}
                    index={idx}
                    isLast={idx === result.stepResults.length - 1}
                    onMark={(status) => onMarkStep(step.id, status)}
                  />
                ))}
          </>
        )}
      </div>
    </div>
  )
}

function StepRow({
  step,
  index,
  isLast,
  onMark,
}: {
  step: RunResult['stepResults'][number]
  index: number
  isLast: boolean
  onMark: (status: 'pass' | 'fail' | 'skip') => Promise<void>
}) {
  const [rowHovered, setRowHovered] = useState(false)
  const circle =
    STEP_CIRCLE_STYLE[step.status as keyof typeof STEP_CIRCLE_STYLE] ?? STEP_CIRCLE_STYLE.pending
  const BTN_COLORS = { pass: '#22c55e', fail: '#ef4444', skip: '#f59e0b' } as const

  return (
    <div
      style={{ display: 'flex', padding: '0 16px' }}
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
    >
      {/* Timeline: circle + connector */}
      <div
        style={{
          flexShrink: 0,
          width: 26,
          marginRight: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            marginTop: 5,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: circle.bg,
            border: `1.5px solid ${circle.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {step.status === 'pending' ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: circle.color,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {index + 1}
            </span>
          ) : step.status === 'pass' ? (
            <Check size={13} weight="bold" color={circle.color} />
          ) : step.status === 'fail' ? (
            <X size={13} weight="bold" color={circle.color} />
          ) : (
            <Minus size={13} weight="bold" color={circle.color} />
          )}
        </div>
        {/* Connector line to next step */}
        {!isLast && (
          <div
            style={{
              width: 1,
              flex: 1,
              minHeight: 10,
              background: 'var(--t-border-subtle)',
              marginTop: 4,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 8, paddingBottom: isLast ? 12 : 20 }}>
        {/* Action row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div
            className="rich-preview"
            dangerouslySetInnerHTML={{ __html: step.action }}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: step.status === 'pending' ? 400 : 500,
              color:
                step.status === 'pending' ? 'var(--t-text-secondary)' : 'var(--t-text-primary)',
              lineHeight: 1.55,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              overflow: 'hidden',
            }}
          />

          {/* Status buttons — visible only on step row hover */}
          <div
            style={{
              display: 'flex',
              gap: 2,
              flexShrink: 0,
              paddingTop: 2,
              opacity: rowHovered ? 1 : 0,
              transition: 'opacity 0.1s',
            }}
          >
            {(['pass', 'fail', 'skip'] as const).map((s) => {
              const isActive = step.status === s
              const c = BTN_COLORS[s]
              return (
                <button
                  key={s}
                  title={s}
                  onClick={() => onMark(s)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    border: `1px solid ${isActive ? `${c}35` : 'var(--t-border-subtle)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                    background: isActive ? `${c}12` : 'transparent',
                    color: isActive ? c : 'var(--t-border-strong)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = c
                      e.currentTarget.style.borderColor = `${c}35`
                      e.currentTarget.style.background = `${c}0d`
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--t-border-strong)'
                      e.currentTarget.style.borderColor = 'var(--t-border-subtle)'
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  {s === 'pass' ? (
                    <Check size={11} weight="bold" />
                  ) : s === 'fail' ? (
                    <X size={11} weight="bold" />
                  ) : (
                    <Minus size={11} weight="bold" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Expected result */}
        {step.expectedResult && (
          <div
            style={{
              marginTop: 6,
              background: 'var(--t-bg-surface)',
              border: '1px solid var(--t-border-subtle)',
              borderRadius: 5,
              padding: '6px 9px',
              maxWidth: '100%',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 10,
                color: 'var(--t-text-muted)',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Expected
            </span>
            <div
              className="rich-preview"
              dangerouslySetInnerHTML={{ __html: step.expectedResult }}
              style={{
                fontSize: 12,
                color: 'var(--t-text-secondary)',
                lineHeight: 1.5,
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Folder group accordion ───────────────────────────────────────────────────

function FolderGroup({
  folderId,
  folderName,
  folderPath,
  spaceName,
  results,
  appId: _appId2,
  runId: _runId2,
  selectedResultId,
  bulkSelectedIds,
  onMarkResult,
  onResetFolder,
  onRemoveResult,
  onResetResult,
  onSelectResult,
  onToggleBulkSelect,
  onNavigate,
}: {
  folderId: number | null
  folderName: string
  folderPath: string[]
  spaceName: string
  results: RunResult[]
  appId: number
  runId: number
  selectedResultId: number | null
  bulkSelectedIds: Set<number>
  onMarkResult: Props['onMarkResult']
  onResetFolder: (folderId: number) => Promise<void>
  onRemoveResult: (resultId: number, testTitle: string) => void
  onResetResult: (resultId: number) => Promise<void>
  onSelectResult: (result: RunResult) => void
  onToggleBulkSelect: (id: number) => void
  onNavigate: Props['onNavigate']
}) {
  const [open, setOpen] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [resetting, setResetting] = useState(false)

  const pass = results.filter((r) => r.status === 'pass').length
  const fail = results.filter((r) => r.status === 'fail').length
  const skip = results.filter((r) => r.status === 'skip').length
  const blocked = results.filter((r) => r.status === 'blocked').length
  const pending = results.filter((r) => r.status === 'pending').length

  // breadcrumb: Space / ...ancestors
  const crumbs = [spaceName, ...folderPath].filter(Boolean)

  // Folder-level bulk selection state
  const allIds = results.map((r) => r.id)
  const checkedCount = allIds.filter((id) => bulkSelectedIds.has(id)).length
  const allChecked = checkedCount === allIds.length && allIds.length > 0
  const someChecked = checkedCount > 0 && checkedCount < allIds.length
  const bulkMode = bulkSelectedIds.size > 0

  const toggleFolderCheck = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (allChecked) {
      allIds.forEach((id) => bulkSelectedIds.has(id) && onToggleBulkSelect(id))
    } else {
      allIds.forEach((id) => !bulkSelectedIds.has(id) && onToggleBulkSelect(id))
    }
  }

  return (
    <div
      style={{
        margin: '0 16px 10px',
        border: '1px solid var(--t-border-subtle)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--t-bg-surface)',
      }}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setOpen((p) => !p)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          background: hovered ? 'var(--t-bg-hover)' : 'var(--t-bg-surface)',
          border: 'none',
          borderBottom: open ? '1px solid var(--t-border-subtle)' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.1s',
        }}
      >
        {/* Caret */}
        <span style={{ color: 'var(--t-text-muted)', flexShrink: 0, lineHeight: 1, marginTop: 1 }}>
          {open ? <CaretDown size={11} /> : <CaretRight size={11} />}
        </span>

        {/* Folder-level bulk checkbox */}
        <div
          onClick={toggleFolderCheck}
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            borderRadius: 4,
            border: allChecked
              ? '1.5px solid var(--t-text-primary)'
              : someChecked
                ? '1.5px solid var(--t-text-secondary)'
                : '1.5px solid var(--t-border-default)',
            background: allChecked
              ? 'var(--t-text-primary)'
              : someChecked
                ? 'var(--t-bg-elevated)'
                : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.1s',
            opacity: hovered || bulkMode ? 1 : 0,
            pointerEvents: hovered || bulkMode ? 'auto' : 'none',
          }}
        >
          {allChecked && <Check size={10} weight="bold" color="var(--t-bg-base)" />}
          {someChecked && <Minus size={10} weight="bold" color="var(--t-text-primary)" />}
        </div>

        {/* Folder icon */}
        <FolderSimple
          size={18}
          color="var(--t-text-secondary)"
          weight="fill"
          style={{ flexShrink: 0 }}
        />

        {/* Folder name */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--t-text-primary)',
            flexShrink: 0,
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {folderName || 'Uncategorized'}
        </span>

        {/* Breadcrumb separator */}
        {crumbs.length > 0 && (
          <span style={{ color: 'var(--t-text-muted)', fontSize: 12, flexShrink: 0 }}>·</span>
        )}

        {/* Breadcrumb path */}
        {crumbs.length > 0 && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--t-text-muted)',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {crumbs.join(' / ')}
          </span>
        )}

        {/* Spacer if no breadcrumb */}
        {crumbs.length === 0 && <span style={{ flex: 1 }} />}

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 13,
              color: 'var(--t-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {results.length}
          </span>
          {(
            [
              { key: 'pass', count: pass, label: 'Passed' },
              { key: 'fail', count: fail, label: 'Failed' },
              { key: 'skip', count: skip, label: 'Skipped' },
              { key: 'blocked', count: blocked, label: 'Blocked' },
              { key: 'pending', count: pending, label: 'Pending' },
            ] as const
          )
            .filter(({ count }) => count > 0)
            .map(({ key, count, label }) => (
              <div
                key={key}
                title={`${count} ${label}`}
                style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
              >
                <StatusRingIcon status={key} size={18} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: STATUS_TEXT[key] ?? 'var(--t-text-muted)',
                  }}
                >
                  {count}
                </span>
              </div>
            ))}
        </div>

        {/* Reset folder button — stop propagation so it doesn't toggle accordion */}
        {folderId != null && (
          <button
            title="Reset folder progress"
            onClick={async (e) => {
              e.stopPropagation()
              setResetting(true)
              try {
                await onResetFolder(folderId)
              } finally {
                setResetting(false)
              }
            }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 5,
              marginLeft: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '1px solid transparent',
              background: 'transparent',
              color: 'var(--t-border-strong)',
              transition: 'all 0.1s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--t-text-secondary)'
              e.currentTarget.style.background = 'var(--t-sidebar-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--t-border-strong)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <ArrowCounterClockwise size={12} className={resetting ? 'animate-spin' : ''} />
          </button>
        )}
      </button>

      {/* Test rows */}
      {open && (
        <div>
          {results.map((r) => (
            <TestRow
              key={r.id}
              result={r}
              isSelected={selectedResultId === r.id}
              isChecked={bulkSelectedIds.has(r.id)}
              bulkMode={bulkMode}
              onSelect={() => onSelectResult(r)}
              onToggleCheck={() => onToggleBulkSelect(r.id)}
              onMarkResult={onMarkResult}
              onRemove={() => onRemoveResult(r.id, r.testTitle || `Test #${r.testId}`)}
              onResetResult={() => onResetResult(r.id)}
              onGoToSource={() => {
                if (r.folderId != null) {
                  onNavigate({
                    type: 'tests',
                    appId,
                    spaceId: r.spaceId ?? 0,
                    folderId: r.folderId,
                    selectedTestId: r.testId,
                  })
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tree picker helpers ──────────────────────────────────────────────────────

function buildPickerTree(flat: Folder[]): FolderNode[] {
  const map = new Map<number, FolderNode>()
  flat.forEach((f) => map.set(f.id, { ...f, children: [] }))
  const roots: FolderNode[] = []
  flat.forEach((f) => {
    if (f.parentFolderId === null) roots.push(map.get(f.id)!)
    else map.get(f.parentFolderId)?.children.push(map.get(f.id)!)
  })
  return roots
}

function findInTree(id: number, tree: FolderNode[]): FolderNode | null {
  for (const n of tree) {
    if (n.id === id) return n
    const found = findInTree(id, n.children)
    if (found) return found
  }
  return null
}

function flatFolderIds(nodes: FolderNode[]): number[] {
  return nodes.flatMap((n) => [n.id, ...flatFolderIds(n.children)])
}

// ─── TriCheckbox ─────────────────────────────────────────────────────────────

function TriCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={onChange}
      style={{
        width: 13,
        height: 13,
        cursor: 'pointer',
        accentColor: 'var(--t-text-secondary)',
        flexShrink: 0,
      }}
    />
  )
}

// ─── TestTreePicker ───────────────────────────────────────────────────────────

interface TreePickerProps {
  spaces: Space[]
  value: Set<number>
  onChange: (next: Set<number>) => void
}

function TestTreePicker({ spaces, value, onChange }: TreePickerProps) {
  const [spaceExpanded, setSpaceExpanded] = useState<Set<number>>(new Set())
  const [spaceLoading, setSpaceLoading] = useState<Set<number>>(new Set())
  const [spaceFolders, setSpaceFolders] = useState<Map<number, FolderNode[]>>(new Map())
  const [folderExpanded, setFolderExpanded] = useState<Set<number>>(new Set())
  const [folderTestsLoading, setFolderTestsLoading] = useState<Set<number>>(new Set())
  const [folderTests, setFolderTests] = useState<Map<number, Test[]>>(new Map())
  const valueRef = useRef(value)
  valueRef.current = value

  const ensureSpaceFolders = async (spaceId: number): Promise<FolderNode[]> => {
    const existing = spaceFolders.get(spaceId)
    if (existing) return existing
    setSpaceLoading((p) => new Set([...p, spaceId]))
    try {
      const flat = await api.folders.list(spaceId)
      const tree = buildPickerTree(flat)
      setSpaceFolders((p) => new Map([...p, [spaceId, tree]]))
      return tree
    } finally {
      setSpaceLoading((p) => {
        const n = new Set(p)
        n.delete(spaceId)
        return n
      })
    }
  }

  const toggleSpaceExpand = async (spaceId: number) => {
    const willExpand = !spaceExpanded.has(spaceId)
    setSpaceExpanded((p) => {
      const n = new Set(p)
      if (willExpand) n.add(spaceId)
      else n.delete(spaceId)
      return n
    })
    if (willExpand) await ensureSpaceFolders(spaceId)
  }

  const toggleFolderExpand = async (folderId: number) => {
    const willExpand = !folderExpanded.has(folderId)
    setFolderExpanded((p) => {
      const n = new Set(p)
      if (willExpand) n.add(folderId)
      else n.delete(folderId)
      return n
    })
    if (willExpand && !folderTests.has(folderId)) {
      setFolderTestsLoading((p) => new Set([...p, folderId]))
      try {
        const tests = await api.tests.list(folderId)
        setFolderTests((p) => new Map([...p, [folderId, tests]]))
      } finally {
        setFolderTestsLoading((p) => {
          const n = new Set(p)
          n.delete(folderId)
          return n
        })
      }
    }
  }

  const collectLoaded = (
    folderId: number,
    tree: FolderNode[],
    testMap: Map<number, Test[]>
  ): number[] => {
    const direct = (testMap.get(folderId) ?? []).map((t) => t.id)
    const node = findInTree(folderId, tree)
    return [...direct, ...(node?.children.flatMap((c) => collectLoaded(c.id, tree, testMap)) ?? [])]
  }

  const getSelState = (ids: number[]): 'all' | 'some' | 'none' => {
    if (!ids.length) return 'none'
    const sel = ids.filter((id) => value.has(id)).length
    if (sel === ids.length) return 'all'
    if (sel > 0) return 'some'
    return 'none'
  }

  const toggleTest = (testId: number) => {
    const n = new Set(valueRef.current)
    if (n.has(testId)) n.delete(testId)
    else n.add(testId)
    onChange(n)
  }

  const loadAllInFolder = async (
    folderId: number,
    tree: FolderNode[]
  ): Promise<Map<number, Test[]>> => {
    const node = findInTree(folderId, tree)
    const subIds = [folderId, ...flatFolderIds(node?.children ?? [])]
    const toLoad = subIds.filter((fid) => !folderTests.has(fid))
    const updated = new Map(folderTests)
    if (toLoad.length) {
      const results = await Promise.all(
        toLoad.map(async (fid) => ({ fid, tests: await api.tests.list(fid) }))
      )
      results.forEach(({ fid, tests }) => updated.set(fid, tests))
      setFolderTests(updated)
    }
    return updated
  }

  const toggleFolder = async (folderId: number, tree: FolderNode[]) => {
    const testMap = await loadAllInFolder(folderId, tree)
    const ids = collectLoaded(folderId, tree, testMap)
    const allSel = ids.length > 0 && ids.every((id) => valueRef.current.has(id))
    const n = new Set(valueRef.current)
    if (allSel) ids.forEach((id) => n.delete(id))
    else ids.forEach((id) => n.add(id))
    onChange(n)
  }

  const toggleSpaceSelect = async (spaceId: number) => {
    const tree = await ensureSpaceFolders(spaceId)
    const allFolderIds = flatFolderIds(tree)
    const toLoad = allFolderIds.filter((fid) => !folderTests.has(fid))
    const testMap = new Map(folderTests)
    if (toLoad.length) {
      const results = await Promise.all(
        toLoad.map(async (fid) => ({ fid, tests: await api.tests.list(fid) }))
      )
      results.forEach(({ fid, tests }) => testMap.set(fid, tests))
      setFolderTests(testMap)
    }
    const collectAll = (nodes: FolderNode[]): number[] =>
      nodes.flatMap((node) => [
        ...(testMap.get(node.id) ?? []).map((t) => t.id),
        ...collectAll(node.children),
      ])
    const ids = collectAll(tree)
    const allSel = ids.length > 0 && ids.every((id) => valueRef.current.has(id))
    const n = new Set(valueRef.current)
    if (allSel) ids.forEach((id) => n.delete(id))
    else ids.forEach((id) => n.add(id))
    onChange(n)
  }

  const renderFolder = (folder: FolderNode, tree: FolderNode[], depth: number): React.ReactNode => {
    const isExpanded = folderExpanded.has(folder.id)
    const isTestsLoading = folderTestsLoading.has(folder.id)
    const tests = folderTests.get(folder.id) ?? []
    const ids = collectLoaded(folder.id, tree, folderTests)
    const state = getSelState(ids)
    const selCount = ids.filter((id) => value.has(id)).length

    return (
      <div key={folder.id}>
        {/* Folder row */}
        <div
          className="flex items-center gap-2 group cursor-pointer select-none"
          style={{
            paddingLeft: depth * 20 + 12,
            paddingRight: 12,
            height: 34,
            borderBottom: '1px solid var(--t-border-subtle)',
          }}
          onClick={() => toggleFolderExpand(folder.id)}
        >
          <span className="text-muted-foreground w-3 h-3 flex items-center justify-center shrink-0">
            {isTestsLoading ? (
              <CircleNotch size={10} className="animate-spin" />
            ) : isExpanded ? (
              <CaretDown size={10} />
            ) : (
              <CaretRight size={10} />
            )}
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <TriCheckbox
              checked={state === 'all'}
              indeterminate={state === 'some'}
              onChange={() => toggleFolder(folder.id, tree)}
            />
          </span>
          <FolderSimple size={13} color="var(--t-text-muted)" weight="fill" />
          <span
            style={{
              fontSize: 12,
              color: 'var(--t-text-secondary)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {folder.name}
          </span>
          {ids.length > 0 && (
            <span
              style={{
                fontSize: 10,
                color: selCount > 0 ? 'var(--t-text-secondary)' : 'var(--t-text-muted)',
                background: selCount > 0 ? 'var(--t-bg-elevated)' : 'transparent',
                border: selCount > 0 ? '1px solid var(--t-border-default)' : 'none',
                borderRadius: 4,
                padding: selCount > 0 ? '1px 5px' : undefined,
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {selCount > 0 ? `${selCount}/${ids.length}` : ids.length}
            </span>
          )}
        </div>
        {isExpanded && (
          <>
            {tests.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 cursor-pointer select-none group"
                style={{
                  paddingLeft: depth * 20 + 36,
                  paddingRight: 12,
                  height: 32,
                  borderBottom: '1px solid var(--t-border-subtle)',
                  background: value.has(t.id) ? 'var(--t-sidebar-hover)' : 'transparent',
                }}
                onClick={() => toggleTest(t.id)}
              >
                <span onClick={(e) => e.stopPropagation()}>
                  <TriCheckbox
                    checked={value.has(t.id)}
                    indeterminate={false}
                    onChange={() => toggleTest(t.id)}
                  />
                </span>
                <TestTube
                  size={11}
                  color={value.has(t.id) ? 'var(--t-text-secondary)' : 'var(--t-text-muted)'}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: value.has(t.id) ? 'var(--t-text-primary)' : 'var(--t-text-secondary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.title}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    color: 'var(--t-text-muted)',
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border-default)',
                    borderRadius: 3,
                    padding: '1px 4px',
                    flexShrink: 0,
                    textTransform: 'uppercase',
                  }}
                >
                  {t.type === 'bdd' ? 'BDD' : 'STD'}
                </span>
              </div>
            ))}
            {folder.children.map((child) => renderFolder(child, tree, depth + 1))}
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      {spaces.length === 0 && (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--t-text-muted)',
            fontSize: 13,
          }}
        >
          No spaces available.
        </div>
      )}
      <div>
        {spaces.map((space) => {
          const isExpanded = spaceExpanded.has(space.id)
          const isLoading = spaceLoading.has(space.id)
          const tree = spaceFolders.get(space.id) ?? []
          const allIds = tree.flatMap((n) => collectLoaded(n.id, tree, folderTests))
          const state = getSelState(allIds)
          const selCount = allIds.filter((id) => value.has(id)).length

          return (
            <div key={space.id}>
              {/* Space header row */}
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                style={{
                  padding: '0 12px',
                  height: 40,
                  background: 'var(--t-bg-surface)',
                  borderBottom: '1px solid var(--t-border-default)',
                  borderTop: '1px solid var(--t-border-default)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
                onClick={() => toggleSpaceExpand(space.id)}
              >
                <span className="text-muted-foreground w-3 h-3 flex items-center justify-center shrink-0">
                  {isLoading ? (
                    <CircleNotch size={11} className="animate-spin" />
                  ) : isExpanded ? (
                    <CaretDown size={11} />
                  ) : (
                    <CaretRight size={11} />
                  )}
                </span>
                <span onClick={(e) => e.stopPropagation()}>
                  <TriCheckbox
                    checked={state === 'all'}
                    indeterminate={state === 'some'}
                    onChange={() => toggleSpaceSelect(space.id)}
                  />
                </span>
                <Cube size={13} color="var(--t-text-secondary)" weight="fill" />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--t-text-primary)',
                    flex: 1,
                    letterSpacing: '0.01em',
                  }}
                >
                  {space.name}
                </span>
                {allIds.length > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontVariantNumeric: 'tabular-nums',
                      color: selCount > 0 ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
                      background: selCount > 0 ? 'var(--t-bg-elevated)' : 'var(--t-sidebar-hover)',
                      border: '1px solid var(--t-border-default)',
                      borderRadius: 4,
                      padding: '2px 7px',
                    }}
                  >
                    {selCount > 0 ? `${selCount} / ${allIds.length}` : `${allIds.length} tests`}
                  </span>
                )}
              </div>
              {isExpanded && (
                <>
                  {isLoading && (
                    <div
                      style={{
                        padding: '10px 16px',
                        fontSize: 11,
                        color: 'var(--t-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <CircleNotch size={10} className="animate-spin" /> Loading folders…
                    </div>
                  )}
                  {!isLoading && tree.length === 0 && (
                    <div
                      style={{
                        padding: '10px 16px',
                        fontSize: 11,
                        color: 'var(--t-text-muted)',
                        fontStyle: 'italic',
                      }}
                    >
                      No folders in this space.
                    </div>
                  )}
                  {tree.map((folder) => renderFolder(folder, tree, 1))}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RunExecution({
  run,
  results,
  report,
  loading,
  appId,
  spaces,
  onNavigate,
  onMarkResult,
  onSetRunStatus,
  onRefreshResults,
}: Props) {
  const [addTestsOpen, setAddTestsOpen] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [selectedPickerIds, setSelectedPickerIds] = useState<Set<number>>(new Set())
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null)
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<number>>(new Set())
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string
    description: string
    confirmLabel: string
    onConfirm: () => Promise<void>
  } | null>(null)
  const [filterPriority, setFilterPriority] = useState<Set<string>>(new Set())
  const [filterCategory, setFilterCategory] = useState<Set<string>>(new Set())
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<Set<string>>(new Set())
  const [folderSort, setFolderSort] = useState<'default' | 'asc' | 'desc'>('default')

  // ── Filter derived values ────────────────────────────────────────────────
  const allPriorities = useMemo(() => {
    const s = new Set<string>()
    results.forEach((r) => {
      if (r.priority) s.add(r.priority)
    })
    return [...s].sort()
  }, [results])

  const allCategories = useMemo(() => {
    const s = new Set<string>()
    results.forEach((r) => {
      if (r.category) s.add(r.category)
    })
    return [...s].sort()
  }, [results])

  const allTags = useMemo(() => {
    const s = new Set<string>()
    results.forEach((r) => {
      if (!r.tags) return
      try {
        ;(JSON.parse(r.tags) as string[]).forEach((t) => s.add(t))
      } catch {
        /* */
      }
    })
    return [...s].sort()
  }, [results])

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (filterStatus.size > 0 && !filterStatus.has(r.status)) return false
      if (filterPriority.size > 0 && !filterPriority.has(r.priority)) return false
      if (filterCategory.size > 0 && (!r.category || !filterCategory.has(r.category))) return false
      if (filterTags.size > 0) {
        let tagList: string[] = []
        try {
          tagList = r.tags ? (JSON.parse(r.tags) as string[]) : []
        } catch {
          /* */
        }
        const hasTag = tagList.some((t) => filterTags.has(t))
        if (!hasTag) return false
      }
      return true
    })
  }, [results, filterStatus, filterPriority, filterCategory, filterTags])

  const anyFilterActive =
    filterStatus.size > 0 ||
    filterPriority.size > 0 ||
    filterCategory.size > 0 ||
    filterTags.size > 0

  // ── Bulk selection helpers ────────────────────────────────────────────────
  const toggleBulkSelect = (id: number) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearBulkSelect = () => setBulkSelectedIds(new Set())

  const handleBulkMark = async (status: 'pass' | 'fail' | 'skip' | 'blocked') => {
    if (!run || bulkSelectedIds.size === 0) return
    await Promise.all(
      [...bulkSelectedIds].map((id) => onMarkResult(id, status, { propagateToSteps: true }))
    )
    clearBulkSelect()
  }

  const handleBulkReset = async () => {
    if (!run || bulkSelectedIds.size === 0) return
    await Promise.all([...bulkSelectedIds].map((id) => api.runs.resetResult(appId, run.id, id)))
    await onRefreshResults()
    clearBulkSelect()
  }

  const handleBulkRemove = () => {
    if (!run || bulkSelectedIds.size === 0) return
    const count = bulkSelectedIds.size
    setPendingConfirm({
      title: `Remove ${count} test${count === 1 ? '' : 's'} from run`,
      description: `${count} selected test${count === 1 ? '' : 's'} will be removed from this run. Their results will be lost.`,
      confirmLabel: `Remove ${count}`,
      onConfirm: async () => {
        await Promise.all(
          [...bulkSelectedIds].map((id) => api.runs.removeResult(appId, run.id, id))
        )
        if (selectedResultId !== null && bulkSelectedIds.has(selectedResultId)) {
          setSelectedResultId(null)
        }
        await onRefreshResults()
        clearBulkSelect()
      },
    })
  }

  const handleAddTests = async () => {
    if (!run || !selectedPickerIds.size) return
    setAddSaving(true)
    try {
      const pack = [...selectedPickerIds].map((id) => ({ scopeType: 'test' as const, scopeId: id }))
      await api.runs.addItems(appId, run.id, pack)
      await onRefreshResults()
      setSelectedPickerIds(new Set())
      setAddTestsOpen(false)
    } finally {
      setAddSaving(false)
    }
  }

  const handleResetRun = async () => {
    if (!run) return
    await api.runs.resetProgress(appId, run.id)
    await onSetRunStatus('pending')
    await onRefreshResults()
  }

  const handleResetFolder = async (folderId: number) => {
    if (!run) return
    await api.runs.resetProgress(appId, run.id, folderId)
    await onRefreshResults()
  }

  const handleRemoveResult = (resultId: number, testTitle: string) => {
    setPendingConfirm({
      title: 'Remove test from run',
      description: `"${testTitle}" will be removed from this run. Its results will be lost.`,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        if (!run) return
        await api.runs.removeResult(appId, run.id, resultId)
        if (selectedResultId === resultId) setSelectedResultId(null)
        await onRefreshResults()
      },
    })
  }

  const handleResetResult = async (resultId: number) => {
    if (!run) return
    await api.runs.resetResult(appId, run.id, resultId)
    await onRefreshResults()
  }

  const handleMarkStep = async (
    resultId: number,
    stepResultId: number,
    status: 'pass' | 'fail' | 'skip'
  ) => {
    if (!run) return
    await api.runs.markStep(appId, run.id, resultId, stepResultId, { status })
    await onRefreshResults()
  }

  if (loading || !run)
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    )

  const s = report?.summary ?? {
    total: 0,
    pass: 0,
    fail: 0,
    skip: 0,
    blocked: 0,
    pending: 0,
    passRate: 0,
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 h-14 shrink-0 gap-4"
        style={{ borderBottom: '1px solid var(--t-border-subtle)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate({ type: 'runs', appId })}
            className="shrink-0 gap-1.5 text-muted-foreground"
          >
            <ArrowLeft size={14} /> Runs
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-semibold text-foreground truncate">{run.name}</h1>
          <span
            className={cn(
              'text-[11px] font-medium px-2.5 py-0.5 rounded-full border shrink-0',
              RUN_STATUS_BADGE[run.status] ?? RUN_STATUS_BADGE.pending
            )}
          >
            {run.status}
          </span>
          {run.environment && (
            <span className="text-xs text-muted-foreground shrink-0">{run.environment}</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetRun}
            className="gap-1.5 text-muted-foreground"
            title="Reset all test progress in this run"
          >
            <ArrowCounterClockwise size={13} /> Reset
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedPickerIds(new Set())
              setAddTestsOpen(true)
            }}
            className="gap-1.5"
          >
            <Plus size={13} /> Add Tests
          </Button>
          {run.status === 'pending' && (
            <Button
              size="sm"
              onClick={() =>
                setPendingConfirm({
                  title: 'Start run',
                  description: `Start "${run.name}"? This will mark it as running and allow you to record test results.`,
                  confirmLabel: 'Start',
                  onConfirm: () => onSetRunStatus('running'),
                })
              }
            >
              <Play size={13} weight="fill" /> Start
            </Button>
          )}
          {run.status === 'running' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-green border-green/30 hover:bg-green/10"
                onClick={() => onSetRunStatus('passed')}
              >
                <CheckCircle size={13} weight="fill" /> Pass
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => onSetRunStatus('failed')}
              >
                <XCircle size={13} weight="fill" /> Fail
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setPendingConfirm({
                    title: 'Abort run',
                    description: `Abort "${run.name}"? The run will be marked as aborted. You can restart it later.`,
                    confirmLabel: 'Abort',
                    onConfirm: () => onSetRunStatus('aborted'),
                  })
                }
              >
                <StopCircle size={13} /> Abort
              </Button>
            </>
          )}
          {(run.status === 'passed' || run.status === 'failed' || run.status === 'aborted') && (
            <Button size="sm" variant="outline" onClick={() => onSetRunStatus('running')}>
              <Play size={13} weight="fill" /> Restart
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div
        className="px-6 py-4 flex items-center gap-8 shrink-0"
        style={{ borderBottom: '1px solid var(--t-border-subtle)' }}
      >
        {[
          { label: 'Total', value: s.total, cls: 'text-foreground' },
          { label: 'Pass', value: s.pass, cls: 'text-green' },
          { label: 'Fail', value: s.fail, cls: 'text-destructive' },
          { label: 'Skip', value: s.skip, cls: 'text-yellow' },
          { label: 'Block', value: s.blocked, cls: 'text-purple' },
          { label: 'Pending', value: s.pending, cls: 'text-muted-foreground' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <span className={cn('text-2xl font-bold tabular-nums', cls)}>{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="w-36 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-green rounded-full transition-all duration-700"
              style={{ width: `${s.passRate}%` }}
            />
          </div>
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              s.passRate >= 80
                ? 'text-green'
                : s.passRate >= 50
                  ? 'text-yellow'
                  : 'text-destructive'
            )}
          >
            {s.passRate}%
          </span>
        </div>
      </div>

      {/* Results — split layout when panel open */}
      <div className="flex-1 overflow-hidden flex flex-row">
        {/* Left: folder groups list */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Bulk action bar — only visible when items are selected */}
          {bulkSelectedIds.size > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderBottom: '1px solid var(--t-border-subtle)',
                background: 'var(--t-bg-surface)',
                flexShrink: 0,
              }}
            >
              <button
                onClick={clearBulkSelect}
                title="Clear selection"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  border: '1px solid var(--t-border-default)',
                  background: 'transparent',
                  color: 'var(--t-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={12} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', flexShrink: 0 }}>
                {bulkSelectedIds.size} selected
              </span>
              <div style={{ flex: 1 }} />
              {/* Mark actions */}
              {(
                [
                  { s: 'pass' as const, label: 'Pass', color: '#22c55e' },
                  { s: 'fail' as const, label: 'Fail', color: '#ef4444' },
                  { s: 'skip' as const, label: 'Skip', color: '#f59e0b' },
                  { s: 'blocked' as const, label: 'Block', color: '#f97316' },
                ] as const
              ).map(({ s, label, color }) => (
                <button
                  key={s}
                  onClick={() => handleBulkMark(s)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${color}18`
                    e.currentTarget.style.borderColor = `${color}44`
                    e.currentTarget.style.color = color
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'var(--t-border-default)'
                    e.currentTarget.style.color = 'var(--t-text-secondary)'
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 5,
                    border: '1px solid var(--t-border-default)',
                    background: 'transparent',
                    color: 'var(--t-text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {STATUS_ICON_IDLE[s]} {label}
                </button>
              ))}
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: 'var(--t-border-default)',
                  flexShrink: 0,
                }}
              />
              {/* Reset */}
              <button
                onClick={handleBulkReset}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--t-sidebar-hover)'
                  e.currentTarget.style.color = 'var(--t-text-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--t-text-secondary)'
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  border: '1px solid var(--t-border-default)',
                  background: 'transparent',
                  color: 'var(--t-text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <ArrowCounterClockwise size={13} /> Reset
              </button>
              {/* Remove */}
              <button
                onClick={handleBulkRemove}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.07)'
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'
                  e.currentTarget.style.color = 'var(--t-accent-danger)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'var(--t-border-default)'
                  e.currentTarget.style.color = 'var(--t-text-secondary)'
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  border: '1px solid var(--t-border-default)',
                  background: 'transparent',
                  color: 'var(--t-text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Trash size={13} /> Remove
              </button>
            </div>
          )}
          {/* Filter + sort bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderBottom: '1px solid var(--t-border-subtle)',
              background: anyFilterActive ? 'var(--t-bg-surface)' : 'transparent',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            <FilterDropdown
              label="Status"
              options={['pending', 'pass', 'fail', 'skip', 'blocked']}
              selected={filterStatus}
              onChange={setFilterStatus}
            />
            <FilterDropdown
              label="Priority"
              options={allPriorities}
              selected={filterPriority}
              onChange={setFilterPriority}
            />
            <FilterDropdown
              label="Category"
              options={allCategories}
              selected={filterCategory}
              onChange={setFilterCategory}
            />
            <FilterDropdown
              label="Tags"
              options={allTags}
              selected={filterTags}
              onChange={setFilterTags}
            />
            {anyFilterActive && (
              <button
                onClick={() => {
                  setFilterStatus(new Set())
                  setFilterPriority(new Set())
                  setFilterCategory(new Set())
                  setFilterTags(new Set())
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  borderRadius: 5,
                  border: '1px solid var(--t-border-subtle)',
                  background: 'transparent',
                  color: 'var(--t-text-muted)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                <X size={10} /> Clear all
              </button>
            )}
            <div style={{ flex: 1 }} />
            {/* Folder sort toggle */}
            <button
              onClick={() =>
                setFolderSort((p) => (p === 'default' ? 'asc' : p === 'asc' ? 'desc' : 'default'))
              }
              title={
                folderSort === 'default'
                  ? 'Sort folders A→Z'
                  : folderSort === 'asc'
                    ? 'Sort folders Z→A'
                    : 'Remove sort'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 5,
                border: `1px solid ${folderSort !== 'default' ? 'var(--t-border-strong)' : 'var(--t-border-default)'}`,
                background: folderSort !== 'default' ? 'var(--t-bg-surface)' : 'transparent',
                color:
                  folderSort !== 'default' ? 'var(--t-text-primary)' : 'var(--t-text-secondary)',
                fontSize: 12,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.1s',
              }}
            >
              <ArrowsDownUp size={12} weight={folderSort !== 'default' ? 'bold' : 'regular'} />
              Folders{folderSort === 'asc' ? ' A→Z' : folderSort === 'desc' ? ' Z→A' : ''}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <FolderOpen size={32} color="#333" />
                <div className="text-center">
                  <p className="text-sm">No tests in this run yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Click "Add Tests" to select spaces or folders to include.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedPickerIds(new Set())
                    setAddTestsOpen(true)
                  }}
                  className="gap-1.5"
                >
                  <Plus size={13} /> Add Tests
                </Button>
              </div>
            ) : (
              (() => {
                const groupMap = new Map<number | null, RunResult[]>()
                for (const r of filteredResults) {
                  const key = r.folderId ?? null
                  if (!groupMap.has(key)) groupMap.set(key, [])
                  groupMap.get(key)!.push(r)
                }
                const entries = [...groupMap.entries()]
                if (folderSort !== 'default') {
                  entries.sort(([, aItems], [, bItems]) => {
                    const aName = (aItems[0].folderName || '').toLowerCase()
                    const bName = (bItems[0].folderName || '').toLowerCase()
                    return folderSort === 'asc'
                      ? aName.localeCompare(bName)
                      : bName.localeCompare(aName)
                  })
                }
                if (entries.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                      <Funnel size={28} color="#555" />
                      <p className="text-sm">No tests match the current filters</p>
                      <button
                        onClick={() => {
                          setFilterStatus(new Set())
                          setFilterPriority(new Set())
                          setFilterCategory(new Set())
                          setFilterTags(new Set())
                        }}
                        style={{
                          fontSize: 12,
                          color: 'var(--t-text-secondary)',
                          background: 'transparent',
                          border: '1px solid var(--t-border-default)',
                          borderRadius: 5,
                          padding: '4px 12px',
                          cursor: 'pointer',
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )
                }
                return (
                  <div className="py-3">
                    {entries.map(([folderId, items]) => (
                      <FolderGroup
                        key={folderId ?? -1}
                        folderId={folderId}
                        folderName={items[0].folderName || 'Uncategorized'}
                        folderPath={items[0].folderPath ?? []}
                        spaceName={items[0].spaceName || ''}
                        results={items}
                        appId={appId}
                        runId={run.id}
                        selectedResultId={selectedResultId}
                        bulkSelectedIds={bulkSelectedIds}
                        onMarkResult={onMarkResult}
                        onResetFolder={handleResetFolder}
                        onRemoveResult={handleRemoveResult}
                        onResetResult={handleResetResult}
                        onToggleBulkSelect={toggleBulkSelect}
                        onSelectResult={(r) =>
                          setSelectedResultId((prev) => (prev === r.id ? null : r.id))
                        }
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                )
              })()
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        {selectedResultId != null &&
          (() => {
            const selected = results.find((r) => r.id === selectedResultId)
            if (!selected) return null
            return (
              <TestDetailPanel
                result={selected}
                appId={appId}
                runId={run.id}
                onClose={() => setSelectedResultId(null)}
                onMarkResult={onMarkResult}
                onResetResult={() => handleResetResult(selected.id)}
                onMarkStep={(stepResultId, status) =>
                  handleMarkStep(selected.id, stepResultId, status)
                }
              />
            )
          })()}
      </div>

      {/* Add Tests picker */}
      <DialogPrimitive.Root open={addTestsOpen} onOpenChange={setAddTestsOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--t-overlay)',
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
              width: 700,
              maxWidth: 'calc(100vw - 32px)',
              height: 580,
              maxHeight: 'calc(100vh - 64px)',
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 12,
              boxShadow: 'var(--t-shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 20px',
                borderBottom: '1px solid var(--t-border-subtle)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: 'var(--t-bg-surface)',
                  border: '1px solid var(--t-border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Plus size={14} color="var(--t-text-secondary)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <DialogPrimitive.Title
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--t-text-primary)',
                    margin: 0,
                  }}
                >
                  Add Tests to Run
                </DialogPrimitive.Title>
                <p style={{ fontSize: 11, color: 'var(--t-text-muted)', margin: 0, marginTop: 2 }}>
                  Expand spaces and folders to select tests individually or in bulk.
                </p>
              </div>
              <DialogPrimitive.Close
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'var(--t-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ✕
              </DialogPrimitive.Close>
            </div>

            {/* Scrollable tree area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                background: 'var(--t-bg-base)',
                borderBottom: '1px solid var(--t-border-subtle)',
              }}
            >
              <TestTreePicker
                spaces={spaces}
                value={selectedPickerIds}
                onChange={setSelectedPickerIds}
              />
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                flexShrink: 0,
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedPickerIds.size > 0 ? (
                  <>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--t-text-primary)',
                        background: 'var(--t-bg-elevated)',
                        border: '1px solid var(--t-border-default)',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {selectedPickerIds.size}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                      test{selectedPickerIds.size === 1 ? '' : 's'} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPickerIds(new Set())}
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-muted)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                    No tests selected
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="outline" size="sm" onClick={() => setAddTestsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddTests}
                  disabled={addSaving || !selectedPickerIds.size}
                >
                  <Plus size={13} />
                  {addSaving
                    ? 'Adding…'
                    : `Add ${selectedPickerIds.size || 0} Test${selectedPickerIds.size === 1 ? '' : 's'}`}
                </Button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Confirm dialog — used by Start, Abort, Remove, Bulk Remove */}
      <ConfirmDialog
        open={pendingConfirm !== null}
        title={pendingConfirm?.title ?? ''}
        description={pendingConfirm?.description ?? ''}
        confirmLabel={pendingConfirm?.confirmLabel ?? 'Confirm'}
        onConfirm={async () => {
          if (!pendingConfirm) return
          await pendingConfirm.onConfirm()
          setPendingConfirm(null)
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  )
}
