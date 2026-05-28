import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  Trash,
  TestTube,
  Cube,
  FolderOpen,
  FolderSimplePlus,
  PencilSimple,
  X,
  CaretDown,
  CaretRight,
  ListChecks,
  GitBranch,
  CopySimple,
  Scissors,
  ClipboardText,
  Square,
  CheckSquare,
  UploadSimple,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button.js'
import { ConfirmDialog } from '@/components/ui/confirm-dialog.js'
import { RowMenu } from '@/components/ui/row-menu.js'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { TestDetail, View } from '../../types/index.js'
import { api } from '../../lib/api.js'
import { useClipboard } from '../../contexts/ClipboardContext.js'
import { useTests } from '../../features/tests/hooks.js'

interface Props {
  appId: number
  activeSpaceId: number | undefined
  activeFolderId: number | undefined
  selectedTestId: number | null
  onSelectTest: (testId: number | null) => void
  onNavigate: (v: View) => void
  onAddSpace?: () => void
  onAddFolder?: () => void
  onImportFromTestMu?: () => void
  onImportFromTestRail?: () => void
  onImportFromCsv?: () => void
}

const PRIORITY_COLOR: Record<string, string> = {
  low: '#6b7280',
  medium: '#d97706',
  high: '#ea580c',
  critical: '#dc2626',
}
const STATUS_COLOR: Record<string, string> = {
  draft: '#6b7280',
  active: '#16a34a',
  deprecated: '#4b5563',
}
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const STATUSES = ['draft', 'active', 'deprecated']
const BDD_STEP_COLOR: Record<string, string> = {
  given: '#9ca3af',
  when: '#9ca3af',
  then: '#9ca3af',
  and: '#6b7280',
  but: '#6b7280',
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        padding: '7px 0',
        borderBottom: '1px solid var(--t-border-subtle)',
      }}
    >
      <span
        style={{
          width: 100,
          flexShrink: 0,
          fontSize: 12,
          color: 'var(--t-text-muted)',
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{children}</span>
    </div>
  )
}

function Accordion({
  title,
  defaultOpen,
  badge,
  children,
}: {
  title: string
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div style={{ borderBottom: '1px solid var(--t-border-subtle)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--t-text-muted)',
          textAlign: 'left',
        }}
      >
        <span style={{ color: 'var(--t-text-muted)', flexShrink: 0 }}>
          {open ? <CaretDown size={11} weight="bold" /> : <CaretRight size={11} weight="bold" />}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--t-text-muted)',
            flex: 1,
          }}
        >
          {title}
        </span>
        {badge}
      </button>
      {open && <div style={{ padding: '0 20px 16px' }}>{children}</div>}
    </div>
  )
}

function DetailPanel({
  folderId,
  testId,
  onClose,
  onEdit,
}: {
  folderId: number
  testId: number
  appId: number
  spaceId: number
  activeFolderId: number
  onClose: () => void
  onEdit: () => void
}) {
  const [detail, setDetail] = useState<TestDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.tests
      .get(folderId, testId)
      .then(setDetail)
      .finally(() => setLoading(false))
  }, [folderId, testId])

  return (
    <div
      style={{
        flex: 1,
        borderLeft: '1px solid var(--t-border-default)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--t-bg-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '12px 16px 12px 20px',
          borderBottom: '1px solid var(--t-border-subtle)',
          flexShrink: 0,
          gap: 12,
        }}
      >
        {detail ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--t-text-primary)',
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {detail.title}
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--t-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginTop: 1,
              }}
            >
              {detail.type === 'bdd' ? 'BDD' : 'Traditional'}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Detail</span>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={onEdit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--t-border-subtle)',
              background: 'transparent',
              color: 'var(--t-text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'var(--t-border-default)'
              el.style.color = 'var(--t-text-secondary)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'var(--t-border-subtle)'
              el.style.color = 'var(--t-text-muted)'
            }}
          >
            <PencilSimple size={12} /> Edit
          </button>
          <button
            onClick={onClose}
            style={{
              width: 26,
              height: 26,
              borderRadius: 5,
              border: 'none',
              background: 'transparent',
              color: 'var(--t-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-muted)'
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--t-text-muted)',
              fontSize: 13,
            }}
          >
            Loading…
          </div>
        ) : !detail ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--t-text-muted)',
              fontSize: 13,
            }}
          >
            Not found
          </div>
        ) : (
          <>
            {/* Accordion 1 — Steps / Scenarios (open by default) */}
            <Accordion title={detail.type === 'bdd' ? 'Scenarios' : 'Steps'} defaultOpen>
              {detail.type === 'traditional' ? (
                detail.steps && detail.steps.length > 0 ? (
                  <ol
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {detail.steps.map((s, i) => (
                      <li
                        key={s.id}
                        style={{
                          display: 'flex',
                          gap: 14,
                          padding: '9px 0',
                          borderBottom: '1px solid var(--t-border-subtle)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--t-text-muted)',
                            fontWeight: 700,
                            flexShrink: 0,
                            width: 18,
                            paddingTop: 2,
                            textAlign: 'right',
                          }}
                        >
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            className="rich-preview"
                            dangerouslySetInnerHTML={{ __html: s.action }}
                            style={{
                              fontSize: 13,
                              color: 'var(--t-text-primary)',
                              lineHeight: 1.6,
                            }}
                          />
                          {s.expectedResult && (
                            <div
                              className="rich-preview"
                              dangerouslySetInnerHTML={{ __html: s.expectedResult }}
                              style={{
                                fontSize: 12,
                                color: 'var(--t-text-secondary)',
                                marginTop: 5,
                                paddingTop: 5,
                                borderTop: '1px dashed var(--t-border-subtle)',
                                lineHeight: 1.6,
                              }}
                            />
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--t-text-muted)', fontStyle: 'italic' }}>
                    No steps added.
                  </p>
                )
              ) : detail.scenarios && detail.scenarios.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {detail.scenarios.map((sc) => (
                    <div
                      key={sc.id}
                      style={{
                        background: 'var(--t-bg-surface)',
                        border: '1px solid var(--t-border-subtle)',
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Scenario header */}
                      <div
                        style={{
                          padding: '8px 14px',
                          borderBottom: sc.steps.length
                            ? '1px solid var(--t-border-subtle)'
                            : undefined,
                          background: 'var(--t-bg-panel)',
                        }}
                      >
                        {sc.feature && (
                          <p
                            style={{
                              fontSize: 10,
                              color: 'var(--t-text-muted)',
                              fontFamily: 'monospace',
                              marginBottom: 3,
                              letterSpacing: '0.02em',
                            }}
                          >
                            Feature:{' '}
                            <span style={{ color: 'var(--t-text-secondary)', fontWeight: 500 }}>
                              {sc.feature}
                            </span>
                          </p>
                        )}
                        <p style={{ fontSize: 11, fontFamily: 'monospace' }}>
                          <span style={{ color: 'var(--t-text-muted)' }}>Scenario: </span>
                          <span style={{ color: 'var(--t-text-primary)', fontWeight: 500 }}>
                            {sc.scenario}
                          </span>
                        </p>
                      </div>

                      {/* Steps */}
                      {sc.steps.length > 0 && (
                        <div
                          style={{
                            padding: '8px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                          }}
                        >
                          {sc.steps.map((step) => (
                            <p
                              key={step.id}
                              style={{ fontSize: 12, fontFamily: 'monospace', lineHeight: 1.7 }}
                            >
                              <span
                                style={{
                                  color: BDD_STEP_COLOR[step.type] ?? 'var(--t-text-muted)',
                                  fontWeight: 600,
                                  display: 'inline-block',
                                  width: 38,
                                  textAlign: 'right',
                                  marginRight: 10,
                                }}
                              >
                                {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
                              </span>
                              <span style={{ color: 'var(--t-text-secondary)' }}>{step.text}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--t-text-muted)', fontStyle: 'italic' }}>
                  No scenarios added.
                </p>
              )}
            </Accordion>

            {/* Accordion 2 — Details */}
            <Accordion title="Details">
              <div style={{ paddingTop: 4 }}>
                <PropRow label="Type">
                  <span style={{ textTransform: 'capitalize', color: 'var(--t-text-secondary)' }}>
                    {detail.type}
                  </span>
                </PropRow>
                <PropRow label="Priority">
                  <span
                    style={{
                      color: PRIORITY_COLOR[detail.priority] ?? 'var(--t-text-muted)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {detail.priority}
                  </span>
                </PropRow>
                <PropRow label="Status">
                  <span
                    style={{
                      color: STATUS_COLOR[detail.status] ?? 'var(--t-text-muted)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {detail.status}
                  </span>
                </PropRow>
                {detail.assigneeId && <PropRow label="Assignee">{detail.assigneeId}</PropRow>}
                {detail.createdBy && <PropRow label="Created by">{detail.createdBy}</PropRow>}

                {detail.description && (
                  <div style={{ marginTop: 16 }}>
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 6,
                      }}
                    >
                      Description
                    </p>
                    <div
                      className="rich-preview"
                      dangerouslySetInnerHTML={{ __html: detail.description }}
                      style={{ fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.7 }}
                    />
                  </div>
                )}
                {detail.preconditions && (
                  <div style={{ marginTop: 14 }}>
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 6,
                      }}
                    >
                      Preconditions
                    </p>
                    <div
                      className="rich-preview"
                      dangerouslySetInnerHTML={{ __html: detail.preconditions }}
                      style={{ fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.7 }}
                    />
                  </div>
                )}
                {detail.notes && (
                  <div style={{ marginTop: 14 }}>
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 6,
                      }}
                    >
                      Notes
                    </p>
                    <div
                      className="rich-preview"
                      dangerouslySetInnerHTML={{ __html: detail.notes }}
                      style={{ fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.7 }}
                    />
                  </div>
                )}

                {detail.tags &&
                  (() => {
                    try {
                      const tags = JSON.parse(detail.tags) as string[]
                      if (!tags.length) return null
                      return (
                        <div style={{ marginTop: 14 }}>
                          <p
                            style={{
                              fontSize: 11,
                              color: 'var(--t-text-muted)',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              marginBottom: 8,
                            }}
                          >
                            Tags
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: 12,
                                  padding: '2px 10px',
                                  borderRadius: 99,
                                  background: 'var(--t-bg-surface)',
                                  color: 'var(--t-text-muted)',
                                  border: '1px solid var(--t-border-subtle)',
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    } catch {
                      return null
                    }
                  })()}
              </div>
            </Accordion>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Bulk Edit Modal ─────────────────────────────────────────────────────────

function BulkEditModal({
  appId,
  testIds,
  open,
  onClose,
  onApplied,
}: {
  appId: number
  testIds: number[]
  open: boolean
  onClose: () => void
  onApplied: () => void
}) {
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [assignee, setAssignee] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagsMode, setTagsMode] = useState<'replace' | 'append'>('replace')
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!open) return
    setPriority('')
    setStatus('')
    setAssignee('')
    setSelectedTags([])
    setTagsMode('replace')
    api.settings
      .get(appId)
      .then((s) => setAvailableTags(s.tags ?? []))
      .catch(() => {})
  }, [open, appId])

  const handleApply = async () => {
    setApplying(true)
    const updates: Parameters<typeof api.bulk.tests.update>[0]['updates'] = {}
    if (priority) updates.priority = priority
    if (status) updates.status = status
    if (assignee.trim()) updates.assigneeId = assignee.trim()
    if (selectedTags.length > 0) {
      updates.tags = selectedTags
      updates.tagsMode = tagsMode
    }
    if (Object.keys(updates).length > 0) {
      await api.bulk.tests.update({ testIds, updates })
    }
    setApplying(false)
    onApplied()
    onClose()
  }

  const fieldLabel = (text: string) => (
    <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 8, marginTop: 0 }}>
      {text}
    </p>
  )

  const chip = (value: string, active: boolean, onClick: () => void, color?: string) => (
    <button
      key={value || 'none'}
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: '1px solid',
        borderColor: active ? 'var(--t-text-primary)' : 'var(--t-border-default)',
        background: active ? 'var(--t-bg-surface)' : 'transparent',
        color: active ? 'var(--t-text-primary)' : (color ?? 'var(--t-text-muted)'),
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {value.charAt(0).toUpperCase() + value.slice(1) || 'No change'}
    </button>
  )

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
            width: 480,
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--t-bg-panel)',
            border: '1px solid var(--t-border-default)',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
            maxHeight: 'calc(100vh - 64px)',
            overflowY: 'auto',
          }}
        >
          {/* Header */}
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--t-text-primary)',
              marginBottom: 4,
            }}
          >
            Edit {testIds.length} test{testIds.length !== 1 ? 's' : ''}
          </p>
          <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 0 }}>
            Only fields you select below will be updated. All others remain unchanged.
          </p>

          {/* Priority */}
          <div style={{ marginTop: 20 }}>
            {fieldLabel('Priority')}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {chip('no change', priority === '', () => setPriority(''))}
              {PRIORITIES.map((p) =>
                chip(p, priority === p, () => setPriority(p), PRIORITY_COLOR[p])
              )}
            </div>
          </div>

          {/* Status */}
          <div style={{ marginTop: 16 }}>
            {fieldLabel('Status')}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {chip('no change', status === '', () => setStatus(''))}
              {STATUSES.map((s) => chip(s, status === s, () => setStatus(s), STATUS_COLOR[s]))}
            </div>
          </div>

          {/* Assignee */}
          <div style={{ marginTop: 16 }}>
            {fieldLabel('Assignee')}
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Leave blank to keep unchanged"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--t-bg-surface)',
                border: '1px solid var(--t-border-default)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 13,
                color: 'var(--t-text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Tags */}
          {availableTags.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                {fieldLabel('Tags')}
                {/* Replace / Append toggle */}
                <div
                  style={{
                    display: 'flex',
                    gap: 2,
                    background: 'var(--t-bg-surface)',
                    padding: 2,
                    borderRadius: 6,
                    border: '1px solid var(--t-border-subtle)',
                    marginBottom: 8,
                  }}
                >
                  {(['replace', 'append'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setTagsMode(m)}
                      style={{
                        padding: '2px 10px',
                        borderRadius: 4,
                        border: 'none',
                        background: tagsMode === m ? 'var(--t-bg-panel)' : 'transparent',
                        color: tagsMode === m ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {availableTags.map((tag) => {
                  const on = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() =>
                        setSelectedTags((prev) =>
                          on ? prev.filter((t) => t !== tag) : [...prev, tag]
                        )
                      }
                      style={{
                        padding: '3px 10px',
                        borderRadius: 99,
                        border: '1px solid',
                        borderColor: on ? 'var(--t-border-default)' : 'var(--t-border-subtle)',
                        background: on ? 'var(--t-bg-surface)' : 'transparent',
                        color: on ? 'var(--t-text-secondary)' : 'var(--t-text-muted)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
              {selectedTags.length > 0 && (
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--t-text-muted)',
                    marginTop: 6,
                    marginBottom: 0,
                  }}
                >
                  {tagsMode === 'replace'
                    ? 'Existing tags will be replaced with selected tags'
                    : 'Selected tags will be added to existing tags'}
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
            <Button variant="outline" size="sm" onClick={onClose} disabled={applying}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply} disabled={applying}>
              {applying
                ? 'Applying…'
                : `Apply to ${testIds.length} test${testIds.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function SpaceView({
  appId,
  activeSpaceId,
  activeFolderId,
  selectedTestId,
  onSelectTest,
  onNavigate,
  onAddSpace,
  onAddFolder,
  onImportFromTestMu,
  onImportFromTestRail,
  onImportFromCsv,
}: Props) {
  const {
    tests,
    loading: testsLoading,
    removeTest,
    refetch: refetchTests,
  } = useTests(activeFolderId ?? null)
  const [confirm, setConfirm] = useState<{ id: number; name: string } | null>(null)
  const { clipboard, copy, cut, clear } = useClipboard()
  const [selectedTestIds, setSelectedTestIds] = useState<Set<number>>(new Set())
  const [hoveredTestId, setHoveredTestId] = useState<number | null>(null)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [importMenuPos, setImportMenuPos] = useState<{ top: number; right: number } | null>(null)
  const importBtnRef = useRef<HTMLButtonElement>(null)
  const importMenuRef = useRef<HTMLDivElement>(null)

  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [newMenuPos, setNewMenuPos] = useState<{ top: number; right: number } | null>(null)
  const newBtnRef = useRef<HTMLButtonElement>(null)
  const newMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!importMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        importMenuRef.current &&
        !importMenuRef.current.contains(e.target as Node) &&
        importBtnRef.current &&
        !importBtnRef.current.contains(e.target as Node)
      )
        setImportMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [importMenuOpen])

  useEffect(() => {
    if (!newMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        newMenuRef.current &&
        !newMenuRef.current.contains(e.target as Node) &&
        newBtnRef.current &&
        !newBtnRef.current.contains(e.target as Node)
      )
        setNewMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [newMenuOpen])

  const openImportMenu = () => {
    if (importBtnRef.current) {
      const r = importBtnRef.current.getBoundingClientRect()
      setImportMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setImportMenuOpen((p) => !p)
  }

  const openNewMenu = () => {
    if (newBtnRef.current) {
      const r = newBtnRef.current.getBoundingClientRect()
      setNewMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setNewMenuOpen((p) => !p)
  }

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedTestIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedTestIds(new Set())
  const selectAll = () => setSelectedTestIds(new Set(tests.map((t) => t.id)))
  const allSelected = tests.length > 0 && selectedTestIds.size === tests.length
  const hasSelection = selectedTestIds.size > 0
  const hasTestsInClipboard = clipboard?.kind === 'test'

  const handleSingleCopy = (id: number) => {
    if (!activeFolderId) return
    copy({ kind: 'test', ids: [id], sourceFolderId: activeFolderId })
  }
  const handleSingleCut = (id: number) => {
    if (!activeFolderId) return
    cut({ kind: 'test', ids: [id], sourceFolderId: activeFolderId })
  }
  const notifyFoldersRefresh = () => window.dispatchEvent(new CustomEvent('sdet:folders:refresh'))

  const handleSingleDuplicate = async (id: number) => {
    if (!activeFolderId) return
    await api.bulk.tests.duplicate({ testIds: [id], targetFolderId: activeFolderId })
    await refetchTests()
    notifyFoldersRefresh()
  }

  const handleBulkCopy = () => {
    if (!activeFolderId) return
    copy({ kind: 'test', ids: [...selectedTestIds], sourceFolderId: activeFolderId })
    clearSelection()
  }
  const handleBulkCut = () => {
    if (!activeFolderId) return
    cut({ kind: 'test', ids: [...selectedTestIds], sourceFolderId: activeFolderId })
    clearSelection()
  }
  const handleBulkDuplicate = async () => {
    if (!activeFolderId) return
    await api.bulk.tests.duplicate({
      testIds: [...selectedTestIds],
      targetFolderId: activeFolderId,
    })
    clearSelection()
    await refetchTests()
    notifyFoldersRefresh()
  }
  const handleBulkDelete = async () => {
    if (!selectedTestIds.size) return
    await api.bulk.tests.delete({ testIds: [...selectedTestIds] })
    clearSelection()
    await refetchTests()
    notifyFoldersRefresh()
  }
  const handlePaste = async () => {
    if (!clipboard || !activeFolderId || clipboard.kind !== 'test') return
    if (clipboard.mode === 'copy') {
      await api.bulk.tests.duplicate({ testIds: clipboard.ids, targetFolderId: activeFolderId })
    } else {
      await api.bulk.tests.move({ testIds: clipboard.ids, targetFolderId: activeFolderId })
    }
    clear()
    await refetchTests()
    notifyFoldersRefresh()
  }

  // ── No space selected ─────────────────────────────────────────────────────
  if (!activeSpaceId) {
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            height: 48,
            borderBottom: '1px solid var(--t-border-subtle)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>
            Spaces
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(onImportFromTestMu || onImportFromTestRail || onImportFromCsv) && (
              <div style={{ position: 'relative' }}>
                <button
                  ref={importBtnRef}
                  onClick={openImportMenu}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 30,
                    fontSize: 12,
                    padding: '0 12px',
                    background: 'transparent',
                    border: '1px solid var(--t-border-default)',
                    borderRadius: 6,
                    color: 'var(--t-text-primary)',
                    cursor: 'pointer',
                    transition: 'border-color 0.1s, background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--t-border-strong)'
                    e.currentTarget.style.background = 'var(--t-bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--t-border-default)'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <UploadSimple size={13} />
                  Import
                  <CaretDown size={11} style={{ marginLeft: 2 }} />
                </button>
                {importMenuOpen &&
                  importMenuPos &&
                  createPortal(
                    <div
                      ref={importMenuRef}
                      style={{
                        position: 'fixed',
                        top: importMenuPos.top,
                        right: importMenuPos.right,
                        zIndex: 9999,
                        minWidth: 190,
                        background: 'var(--t-bg-panel)',
                        border: '1px solid var(--t-border-default)',
                        borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                        overflow: 'hidden',
                        padding: '4px 0',
                      }}
                    >
                      {onImportFromTestMu && (
                        <button
                          onClick={() => {
                            setImportMenuOpen(false)
                            onImportFromTestMu()
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--t-text-secondary)',
                            fontSize: 13,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--t-bg-hover)'
                            e.currentTarget.style.color = 'var(--t-text-primary)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--t-text-secondary)'
                          }}
                        >
                          <UploadSimple size={13} />
                          Import from TestMu
                        </button>
                      )}
                      {onImportFromTestRail && (
                        <button
                          onClick={() => {
                            setImportMenuOpen(false)
                            onImportFromTestRail()
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--t-text-secondary)',
                            fontSize: 13,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--t-bg-hover)'
                            e.currentTarget.style.color = 'var(--t-text-primary)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--t-text-secondary)'
                          }}
                        >
                          <UploadSimple size={13} />
                          Import from TestRail
                        </button>
                      )}
                      {onImportFromCsv && (
                        <button
                          onClick={() => {
                            setImportMenuOpen(false)
                            onImportFromCsv()
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--t-text-secondary)',
                            fontSize: 13,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--t-bg-hover)'
                            e.currentTarget.style.color = 'var(--t-text-primary)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--t-text-secondary)'
                          }}
                        >
                          <UploadSimple size={13} />
                          Import from CSV
                        </button>
                      )}
                    </div>,
                    document.body
                  )}
              </div>
            )}
            {onAddSpace && (
              <Button
                onClick={onAddSpace}
                variant="outline"
                style={{ gap: 6, height: 30, fontSize: 12, padding: '0 12px' }}
              >
                <Plus size={13} />
                Add Space
              </Button>
            )}
          </div>
        </div>
        {/* Empty state */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'var(--t-bg-surface)',
                border: '1px solid var(--t-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Cube size={26} weight="duotone" color="var(--t-text-muted)" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)' }}>
                No space selected
              </p>
              <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 5 }}>
                Create a space to organise your test cases.
              </p>
            </div>
            {onAddSpace && (
              <Button onClick={onAddSpace} variant="outline" style={{ gap: 6 }}>
                <Plus size={14} />
                Add Space
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── No folder selected ────────────────────────────────────────────────────
  if (!activeFolderId) {
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            height: 52,
            borderBottom: '1px solid var(--t-border-subtle)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)' }}>
            Folders
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onImportFromCsv && (
              <Button size="sm" variant="outline" onClick={onImportFromCsv} style={{ gap: 6 }}>
                <UploadSimple size={13} /> Import from CSV
              </Button>
            )}
            {onAddFolder && (
              <Button size="sm" variant="outline" onClick={onAddFolder} style={{ gap: 6 }}>
                <Plus size={13} /> New Folder
              </Button>
            )}
          </div>
        </div>

        {/* Empty state */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'var(--t-bg-surface)',
                border: '1px solid var(--t-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderOpen size={26} weight="duotone" color="var(--t-text-muted)" />
            </div>
            <div>
              <p
                style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)', margin: 0 }}
              >
                No folder selected
              </p>
              <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 5 }}>
                Select a folder from the sidebar or create a new one.
              </p>
            </div>
            {onAddFolder && (
              <Button onClick={onAddFolder} variant="outline" size="sm" style={{ gap: 6 }}>
                <Plus size={13} /> New Folder
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Test list ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--t-bg-base)',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 52,
          borderBottom: '1px solid var(--t-border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)' }}>
            Tests
          </span>
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 99,
              background: 'var(--t-bg-surface)',
              color: 'var(--t-text-muted)',
              fontWeight: 500,
            }}
          >
            {tests.length}
          </span>
          {tests.length > 0 && (
            <button
              onClick={allSelected ? clearSelection : selectAll}
              style={{
                fontSize: 11,
                color: allSelected ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-primary)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.color = allSelected
                  ? 'var(--t-text-primary)'
                  : 'var(--t-text-muted)'
              }}
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onImportFromCsv && (
            <Button size="sm" variant="outline" onClick={onImportFromCsv} style={{ gap: 6 }}>
              <UploadSimple size={13} /> Import from CSV
            </Button>
          )}
          {/* New ▾ dropdown */}
          <Button
            ref={newBtnRef}
            size="sm"
            variant="outline"
            onClick={openNewMenu}
            style={{ gap: 6 }}
          >
            <Plus size={13} />
            New
            <CaretDown size={11} style={{ marginLeft: 2 }} />
          </Button>
          {newMenuOpen &&
            newMenuPos &&
            createPortal(
              <div
                ref={newMenuRef}
                style={{
                  position: 'fixed',
                  top: newMenuPos.top,
                  right: newMenuPos.right,
                  zIndex: 9999,
                  minWidth: 180,
                  background: 'var(--t-bg-panel)',
                  border: '1px solid var(--t-border-default)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  overflow: 'hidden',
                  padding: '4px 0',
                }}
              >
                <button
                  onClick={() => {
                    setNewMenuOpen(false)
                    onNavigate({
                      type: 'test-editor',
                      appId,
                      spaceId: activeSpaceId,
                      folderId: activeFolderId,
                    })
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--t-text-secondary)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--t-bg-hover)'
                    e.currentTarget.style.color = 'var(--t-text-primary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--t-text-secondary)'
                  }}
                >
                  <TestTube size={13} />
                  New Test
                </button>
                {onAddFolder && (
                  <button
                    onClick={() => {
                      setNewMenuOpen(false)
                      onAddFolder()
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--t-text-secondary)',
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--t-bg-hover)'
                      e.currentTarget.style.color = 'var(--t-text-primary)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--t-text-secondary)'
                    }}
                  >
                    <FolderSimplePlus size={13} />
                    New Folder
                  </button>
                )}
              </div>,
              document.body
            )}
        </div>
      </div>

      {/* Paste banner */}
      {hasTestsInClipboard && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 24px',
            background: 'var(--t-bg-surface)',
            borderBottom: '1px solid var(--t-border-subtle)',
            flexShrink: 0,
          }}
        >
          <ClipboardText size={13} color="var(--t-text-muted)" />
          <span style={{ fontSize: 12, color: 'var(--t-text-muted)', flex: 1 }}>
            {clipboard!.ids.length} test{clipboard!.ids.length !== 1 ? 's' : ''}{' '}
            {clipboard!.mode === 'copy' ? 'copied' : 'cut'} — paste into current folder
          </span>
          <button
            onClick={handlePaste}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--t-text-primary)',
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 6,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-strong)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-primary)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-default)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-primary)'
            }}
          >
            Paste here
          </button>
          <button
            onClick={clear}
            title="Clear clipboard"
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: 'var(--t-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-muted)'
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {hasSelection && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 24px',
            background: 'var(--t-bg-surface)',
            borderBottom: '1px solid var(--t-border-subtle)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--t-text-muted)', marginRight: 4 }}>
            {selectedTestIds.size} selected
          </span>
          {(
            [
              { label: 'Copy', icon: <CopySimple size={12} />, action: handleBulkCopy },
              { label: 'Cut', icon: <Scissors size={12} />, action: handleBulkCut },
              { label: 'Duplicate', icon: <CopySimple size={12} />, action: handleBulkDuplicate },
            ] as { label: string; icon: React.ReactNode; action: () => void }[]
          ).map(({ label, icon, action }) => (
            <button
              key={label}
              onClick={action}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                color: 'var(--t-text-secondary)',
                background: 'var(--t-bg-panel)',
                border: '1px solid var(--t-border-default)',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-strong)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-primary)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-default)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
              }}
            >
              {icon}
              {label}
            </button>
          ))}
          <button
            onClick={() => setBulkEditOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              color: 'var(--t-text-secondary)',
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 6,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-strong)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-primary)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-default)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
            }}
          >
            <PencilSimple size={12} />
            Edit
          </button>
          <div
            style={{ width: 1, height: 18, background: 'var(--t-border-default)', margin: '0 4px' }}
          />
          <button
            onClick={handleBulkDelete}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              color: 'var(--t-accent-danger)',
              background: 'transparent',
              border: '1px solid var(--t-border-default)',
              borderRadius: 6,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-accent-danger)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-accent-danger)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-default)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-accent-danger)'
            }}
          >
            <Trash size={12} />
            Move to Trash
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={clearSelection}
            style={{
              fontSize: 12,
              color: 'var(--t-text-muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-muted)'
            }}
          >
            <X size={11} /> Clear
          </button>
        </div>
      )}

      {/* List + detail panel */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {testsLoading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '64px 0',
                color: 'var(--t-text-muted)',
                fontSize: 13,
              }}
            >
              Loading…
            </div>
          ) : tests.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                height: '100%',
                textAlign: 'center',
              }}
            >
              <TestTube size={32} weight="duotone" color="var(--t-text-muted)" />
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)' }}>
                  No tests yet
                </p>
                <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 5 }}>
                  Add your first test to this folder.
                </p>
              </div>
              <Button
                onClick={() =>
                  onNavigate({
                    type: 'test-editor',
                    appId,
                    spaceId: activeSpaceId,
                    folderId: activeFolderId,
                  })
                }
                variant="outline"
                size="sm"
                style={{ gap: 6 }}
              >
                <Plus size={13} /> New Test
              </Button>
            </div>
          ) : (
            tests.map((t, i) => {
              const isSelected = t.id === selectedTestId
              const isChecked = selectedTestIds.has(t.id)
              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTest(isSelected ? null : t.id)}
                  className="test-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '13px 24px',
                    cursor: 'pointer',
                    borderTop: i > 0 ? '1px solid var(--t-border-subtle)' : 'none',
                    transition: 'background 0.1s',
                    background:
                      isChecked || isSelected || hoveredTestId === t.id
                        ? 'var(--t-bg-hover)'
                        : 'transparent',
                    borderLeft: isChecked
                      ? '2px solid var(--t-border-strong)'
                      : isSelected
                        ? '2px solid var(--t-border-default)'
                        : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    setHoveredTestId(t.id)
                    const btns = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
                      '.row-action-btn'
                    )
                    btns.forEach((b) => (b.style.opacity = '1'))
                    const cb = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
                      '.row-checkbox'
                    )
                    if (cb) cb.style.opacity = '1'
                  }}
                  onMouseLeave={(e) => {
                    setHoveredTestId(null)
                    const btns = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
                      '.row-action-btn'
                    )
                    btns.forEach((b) => (b.style.opacity = '0'))
                    const cb = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
                      '.row-checkbox'
                    )
                    if (cb && !isChecked) cb.style.opacity = '0'
                  }}
                >
                  {/* Checkbox */}
                  <button
                    className="row-checkbox"
                    onClick={(e) => toggleSelect(t.id, e)}
                    title={isChecked ? 'Deselect' : 'Select'}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      color: isChecked ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      cursor: 'pointer',
                      opacity: isChecked ? 1 : 0,
                      transition: 'opacity 0.1s',
                    }}
                  >
                    {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>

                  <span
                    title={t.type === 'bdd' ? 'BDD' : 'Traditional'}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--t-bg-surface)',
                      border: '1px solid var(--t-border-subtle)',
                    }}
                  >
                    {t.type === 'bdd' ? (
                      <GitBranch size={13} color="var(--t-text-muted)" />
                    ) : (
                      <ListChecks size={13} color="var(--t-text-muted)" />
                    )}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--t-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.title}
                    </p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'var(--t-text-muted)',
                        }}
                      >
                        {t.status}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: PRIORITY_COLOR[t.priority] ?? 'var(--t-text-muted)',
                        }}
                      >
                        {t.priority}
                      </span>
                    </div>
                  </div>
                  <RowMenu
                    items={[
                      {
                        label: 'Edit',
                        icon: <PencilSimple size={13} />,
                        action: () =>
                          onNavigate({
                            type: 'test-editor',
                            appId,
                            spaceId: activeSpaceId,
                            folderId: activeFolderId,
                            testId: t.id,
                          }),
                      },
                      {
                        label: 'Copy',
                        icon: <CopySimple size={13} />,
                        action: () => handleSingleCopy(t.id),
                        separator: true,
                      },
                      {
                        label: 'Cut',
                        icon: <Scissors size={13} />,
                        action: () => handleSingleCut(t.id),
                      },
                      {
                        label: 'Duplicate',
                        icon: <CopySimple size={13} weight="fill" />,
                        action: () => handleSingleDuplicate(t.id),
                      },
                      {
                        label: 'Delete',
                        icon: <Trash size={13} />,
                        action: () => setConfirm({ id: t.id, name: t.title }),
                        destructive: true,
                        separator: true,
                      },
                    ]}
                  />
                </div>
              )
            })
          )}
        </div>

        {/* Detail panel */}
        {selectedTestId !== null && (
          <DetailPanel
            folderId={activeFolderId}
            testId={selectedTestId}
            appId={appId}
            spaceId={activeSpaceId}
            activeFolderId={activeFolderId}
            onClose={() => onSelectTest(null)}
            onEdit={() =>
              onNavigate({
                type: 'test-editor',
                appId,
                spaceId: activeSpaceId,
                folderId: activeFolderId,
                testId: selectedTestId,
              })
            }
          />
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title="Delete test"
        description={`"${confirm?.name}" will be permanently deleted.`}
        confirmLabel="Delete Test"
        onConfirm={async () => {
          if (confirm) {
            await removeTest(confirm.id)
            setConfirm(null)
          }
        }}
        onCancel={() => setConfirm(null)}
      />

      <BulkEditModal
        appId={appId}
        testIds={[...selectedTestIds]}
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        onApplied={async () => {
          await refetchTests()
        }}
      />
    </div>
  )
}
