import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Plus,
  Trash,
  ClockCounterClockwise,
  ListChecks,
  GitBranch,
  FloppyDisk,
  PencilSimple,
  Check,
  X,
} from '@phosphor-icons/react'
import { Input } from '@/components/ui/input.js'
import { Button } from '@/components/ui/button.js'
import { RichEditor } from '@/components/ui/rich-editor.js'
import type {
  TestDetail,
  TestStep,
  BddScenario,
  View,
  CustomField,
  GlobalTag,
  SpaceTag,
  TestType,
  TestPriority,
  TestStatus,
  AutomationStatus,
} from '../../types/index.js'
import { api } from '../../lib/api.js'
import { TagPicker } from '@/components/ui/tag-picker.js'

const CURRENT_USER = 'me'
const BDD_TYPES = ['given', 'when', 'then', 'and', 'but'] as const
type BddType = (typeof BDD_TYPES)[number]

const BDD_COLORS: Record<BddType, string> = {
  given: 'var(--t-text-primary)',
  when: 'var(--t-text-secondary)',
  then: 'var(--t-accent-success)',
  and: 'var(--t-text-muted)',
  but: 'var(--t-accent-danger)',
}

interface Props {
  folderId: number
  testId?: number
  appId: number
  spaceId: number
  onNavigate: (v: View) => void
  onSaved: () => void
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--t-text-secondary)' }}>
        {label}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{hint}</span>}
    </div>
  )
}

// ─── Select ───────────────────────────────────────────────────────────────────

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--t-bg-base)',
        border: '1px solid var(--t-border-subtle)',
        borderRadius: 8,
        padding: '9px 12px',
        fontSize: 13,
        color: 'var(--t-text-primary)',
        outline: 'none',
        cursor: 'pointer',
        width: '100%',
        appearance: 'auto',
      }}
    >
      {children}
    </select>
  )
}

// ─── Icon button helper ───────────────────────────────────────────────────────

function IconBtn({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void
  title: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26,
        height: 26,
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
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = danger ? 'rgba(229,72,77,0.1)' : 'var(--t-elem-hover)'
        el.style.color = danger ? 'var(--t-accent-danger)' : 'var(--t-text-secondary)'
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

// ─── Traditional steps ────────────────────────────────────────────────────────

function TraditionalStepRow({
  step,
  index,
  folderId,
  testId,
  onRefresh,
}: {
  step: TestStep
  index: number
  folderId: number
  testId: number
  onRefresh: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editAction, setEditAction] = useState(step.action)
  const [editExpected, setEditExpected] = useState(step.expectedResult ?? '')
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setEditAction(step.action)
    setEditExpected(step.expectedResult ?? '')
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const saveEdit = async () => {
    if (!editAction || editAction === '<p></p>') return
    setSaving(true)
    try {
      await api.tests.steps.update(folderId, testId, step.id, {
        action: editAction,
        expectedResult: editExpected && editExpected !== '<p></p>' ? editExpected : '',
      })
      await onRefresh()
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: editing ? '14px 16px 16px' : '14px 16px',
        borderTop: index > 0 ? '1px solid var(--t-border-subtle)' : 'none',
        background: editing ? 'var(--t-bg-panel)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Step number circle */}
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--t-bg-panel)',
          border: '1px solid var(--t-border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--t-text-muted)',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {index + 1}
      </span>

      {editing ? (
        /* ── Edit mode ── */
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--t-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}
            >
              Step action *
            </p>
            <RichEditor
              value={editAction}
              onChange={setEditAction}
              placeholder="Describe the action to perform…"
              minHeight={60}
              autoFocus
            />
          </div>
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--t-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}
            >
              Expected result{' '}
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                (optional)
              </span>
            </p>
            <RichEditor
              value={editExpected}
              onChange={setEditExpected}
              placeholder="What should happen after this step?"
              minHeight={60}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              onClick={saveEdit}
              disabled={saving}
              style={{ gap: 5, height: 30, fontSize: 12 }}
            >
              <Check size={12} weight="bold" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="outline" onClick={cancelEdit} style={{ height: 30, fontSize: 12 }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        /* ── Read mode ── */
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="rich-preview"
              dangerouslySetInnerHTML={{ __html: step.action }}
              style={{
                fontSize: 13,
                color: 'var(--t-text-primary)',
                lineHeight: 1.6,
                wordBreak: 'break-word',
              }}
            />
            {step.expectedResult && (
              <div
                className="rich-preview"
                dangerouslySetInnerHTML={{ __html: step.expectedResult }}
                style={{
                  fontSize: 12,
                  color: 'var(--t-text-secondary)',
                  marginTop: 6,
                  paddingLeft: 10,
                  borderLeft: '2px solid var(--t-border-subtle)',
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                }}
              />
            )}
          </div>
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <IconBtn onClick={startEdit} title="Edit step">
              <PencilSimple size={12} />
            </IconBtn>
            <IconBtn
              onClick={() => api.tests.steps.delete(folderId, testId, step.id).then(onRefresh)}
              title="Delete step"
              danger
            >
              <Trash size={12} />
            </IconBtn>
          </div>
        </>
      )}
    </div>
  )
}

function TraditionalSteps({
  steps,
  folderId,
  testId,
  onRefresh,
}: {
  steps: TestStep[]
  folderId: number
  testId: number
  onRefresh: () => Promise<void>
}) {
  const [action, setAction] = useState('')
  const [expected, setExpected] = useState('')
  const [adding, setAdding] = useState(false)

  const add = async () => {
    if (!action || action === '<p></p>' || adding) return
    setAdding(true)
    try {
      await api.tests.steps.create(folderId, testId, {
        action,
        expectedResult: expected && expected !== '<p></p>' ? expected : undefined,
        order: steps.length,
      })
      setAction('')
      setExpected('')
      await onRefresh()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {steps.length > 0 ? (
        <div
          style={{
            border: '1px solid var(--t-border-subtle)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {steps.map((s, i) => (
            <TraditionalStepRow
              key={s.id}
              step={s}
              index={i}
              folderId={folderId}
              testId={testId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '32px 0',
            textAlign: 'center',
            color: 'var(--t-text-muted)',
            fontSize: 13,
            border: '1px dashed var(--t-border-subtle)',
            borderRadius: 10,
          }}
        >
          No steps yet — add the first one below.
        </div>
      )}

      {/* Add new step */}
      <div
        style={{
          border: '1px solid var(--t-border-subtle)',
          borderRadius: 10,
          overflow: 'hidden',
          background: 'var(--t-bg-panel)',
        }}
      >
        <div
          style={{
            padding: '10px 14px 6px',
            borderBottom: '1px solid var(--t-border-subtle)',
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--t-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            Step action *
          </p>
          <RichEditor
            value={action}
            onChange={setAction}
            placeholder="Describe the action to perform…"
            minHeight={70}
            autoFocus
          />
        </div>
        <div style={{ padding: '10px 14px 10px' }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--t-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            Expected result{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              (optional)
            </span>
          </p>
          <RichEditor
            value={expected}
            onChange={setExpected}
            placeholder="What should happen after this step?"
            minHeight={70}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 14px 12px' }}>
          <Button onClick={add} disabled={adding} variant="outline" style={{ gap: 6 }}>
            <Plus size={13} />
            {adding ? 'Adding…' : 'Add Step'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── BDD scenarios ────────────────────────────────────────────────────────────

function BddScenarioBlock({
  scenario,
  folderId,
  testId,
  onRefresh,
}: {
  scenario: BddScenario
  folderId: number
  testId: number
  onRefresh: () => void
}) {
  const [stepType, setStepType] = useState<BddType>('given')
  const [stepText, setStepText] = useState('')

  // Scenario header edit state
  const [editingHeader, setEditingHeader] = useState(false)
  const [editFeature, setEditFeature] = useState(scenario.feature ?? '')
  const [editScenario, setEditScenario] = useState(scenario.scenario)
  const [savingHeader, setSavingHeader] = useState(false)

  // Per-step edit state: stepId → { type, text }
  const [editingStepId, setEditingStepId] = useState<number | null>(null)
  const [editStepType, setEditStepType] = useState<BddType>('given')
  const [editStepText, setEditStepText] = useState('')
  const [savingStep, setSavingStep] = useState(false)

  const addStep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stepText.trim()) return
    await api.tests.scenarios.steps.create(folderId, testId, scenario.id, {
      type: stepType,
      text: stepText.trim(),
      order: scenario.steps.length,
    })
    setStepText('')
    onRefresh()
  }

  const saveHeader = async () => {
    if (!editScenario.trim()) return
    setSavingHeader(true)
    try {
      await api.tests.scenarios.update(folderId, testId, scenario.id, {
        feature: editFeature.trim() || undefined,
        scenario: editScenario.trim(),
      })
      onRefresh()
      setEditingHeader(false)
    } finally {
      setSavingHeader(false)
    }
  }

  const startEditStep = (step: BddScenario['steps'][number]) => {
    setEditingStepId(step.id)
    setEditStepType(step.type as BddType)
    setEditStepText(step.text)
  }

  const saveStep = async (stepId: number) => {
    if (!editStepText.trim()) return
    setSavingStep(true)
    try {
      await api.tests.scenarios.steps.update(folderId, testId, scenario.id, stepId, {
        type: editStepType,
        text: editStepText.trim(),
      })
      onRefresh()
      setEditingStepId(null)
    } finally {
      setSavingStep(false)
    }
  }

  const stepSelectStyle: React.CSSProperties = {
    background: 'var(--t-bg-panel)',
    border: '1px solid var(--t-border-subtle)',
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: 12,
    color: 'var(--t-text-secondary)',
    outline: 'none',
    width: 84,
    cursor: 'pointer',
  }

  return (
    <div
      style={{
        border: '1px solid var(--t-border-subtle)',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      {/* ── Scenario header ── */}
      <div
        style={{
          padding: '11px 16px',
          borderBottom:
            scenario.steps.length > 0 || editingHeader
              ? '1px solid var(--t-border-subtle)'
              : 'none',
          background: 'var(--t-bg-surface)',
        }}
      >
        {editingHeader ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input
              value={editFeature}
              onChange={(e) => setEditFeature(e.target.value)}
              placeholder="Feature (optional)"
              autoFocus
            />
            <Input
              value={editScenario}
              onChange={(e) => setEditScenario(e.target.value)}
              placeholder="Scenario title *"
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <Button
                onClick={saveHeader}
                disabled={savingHeader}
                style={{ gap: 5, height: 30, fontSize: 12 }}
              >
                <Check size={12} weight="bold" />
                {savingHeader ? 'Saving…' : 'Save'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingHeader(false)}
                style={{ height: 30, fontSize: 12 }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              {scenario.feature && (
                <p
                  style={{
                    fontSize: 10,
                    color: 'var(--t-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 2,
                  }}
                >
                  Feature: {scenario.feature}
                </p>
              )}
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-text-primary)' }}>
                Scenario: {scenario.scenario}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              <IconBtn
                onClick={() => {
                  setEditFeature(scenario.feature ?? '')
                  setEditScenario(scenario.scenario)
                  setEditingHeader(true)
                }}
                title="Edit scenario"
              >
                <PencilSimple size={12} />
              </IconBtn>
              <IconBtn
                onClick={() =>
                  api.tests.scenarios.delete(folderId, testId, scenario.id).then(onRefresh)
                }
                title="Delete scenario"
                danger
              >
                <Trash size={12} />
              </IconBtn>
            </div>
          </div>
        )}
      </div>

      {/* ── Steps ── */}
      <div style={{ padding: '8px 16px 14px' }}>
        {scenario.steps.map((step, i) => (
          <div
            key={step.id}
            style={{
              borderBottom:
                i < scenario.steps.length - 1 ? '1px solid var(--t-border-subtle)' : 'none',
            }}
          >
            {editingStepId === step.id ? (
              /* Edit mode for this step */
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
                <select
                  value={editStepType}
                  onChange={(e) => setEditStepType(e.target.value as BddType)}
                  style={stepSelectStyle}
                >
                  {BDD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
                <Input
                  value={editStepText}
                  onChange={(e) => setEditStepText(e.target.value)}
                  placeholder="Step text…"
                  autoFocus
                />
                <button
                  onClick={() => saveStep(step.id)}
                  disabled={savingStep}
                  title="Save"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 5,
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--t-accent-success)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check size={13} weight="bold" />
                </button>
                <button
                  onClick={() => setEditingStepId(null)}
                  title="Cancel"
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
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              /* Read mode for this step */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  padding: '5px 0',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    width: 36,
                    flexShrink: 0,
                    color: BDD_COLORS[step.type as BddType] ?? 'var(--t-text-muted)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
                </span>
                <span style={{ fontSize: 13, color: 'var(--t-text-primary)', flex: 1 }}>
                  {step.text}
                </span>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <IconBtn onClick={() => startEditStep(step)} title="Edit step">
                    <PencilSimple size={11} />
                  </IconBtn>
                  <IconBtn
                    onClick={() =>
                      api.tests.scenarios.steps
                        .delete(folderId, testId, scenario.id, step.id)
                        .then(onRefresh)
                    }
                    title="Delete step"
                    danger
                  >
                    <Trash size={11} />
                  </IconBtn>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add step form */}
        <form onSubmit={addStep} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <select
            value={stepType}
            onChange={(e) => setStepType(e.target.value as BddType)}
            style={stepSelectStyle}
          >
            {BDD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <Input
            value={stepText}
            onChange={(e) => setStepText(e.target.value)}
            placeholder="Step text…"
          />
          <Button type="submit" variant="outline" style={{ flexShrink: 0, gap: 5, fontSize: 12 }}>
            <Plus size={12} /> Step
          </Button>
        </form>
      </div>
    </div>
  )
}

function BddScenarios({
  scenarios,
  folderId,
  testId,
  onRefresh,
}: {
  scenarios: BddScenario[]
  folderId: number
  testId: number
  onRefresh: () => void
}) {
  const [feature, setFeature] = useState('')
  const [scenarioTitle, setScenarioTitle] = useState('')

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scenarioTitle.trim()) return
    await api.tests.scenarios.create(folderId, testId, {
      feature: feature.trim() || undefined,
      scenario: scenarioTitle.trim(),
    })
    setFeature('')
    setScenarioTitle('')
    onRefresh()
  }

  return (
    <div>
      {scenarios.length === 0 && (
        <div
          style={{
            padding: '32px 0',
            textAlign: 'center',
            color: 'var(--t-text-muted)',
            fontSize: 13,
            border: '1px dashed var(--t-border-subtle)',
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          No scenarios yet — add the first one below.
        </div>
      )}
      {scenarios.map((s) => (
        <BddScenarioBlock
          key={s.id}
          scenario={s}
          folderId={folderId}
          testId={testId}
          onRefresh={onRefresh}
        />
      ))}
      <form onSubmit={add} style={{ display: 'flex', gap: 8 }}>
        <Input
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
          placeholder="Feature (optional)"
          autoFocus
        />
        <Input
          value={scenarioTitle}
          onChange={(e) => setScenarioTitle(e.target.value)}
          placeholder="Scenario title *"
        />
        <Button type="submit" variant="outline" style={{ flexShrink: 0, gap: 6 }}>
          <Plus size={13} /> Scenario
        </Button>
      </form>
    </div>
  )
}

// ─── History ──────────────────────────────────────────────────────────────────

function HistoryTab({ folderId, testId }: { folderId: number; testId: number }) {
  const [history, setHistory] = useState<
    Array<{
      id: number
      field: string
      oldValue: string | null
      newValue: string | null
      changedBy: string
      changedAt: string
    }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.tests.history(folderId, testId).then((h) => {
      setHistory(h)
      setLoading(false)
    })
  }, [folderId, testId])

  if (loading)
    return (
      <div
        style={{
          padding: '48px 0',
          textAlign: 'center',
          color: 'var(--t-text-muted)',
          fontSize: 13,
        }}
      >
        Loading…
      </div>
    )
  if (!history.length)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: '64px 0',
          textAlign: 'center',
        }}
      >
        <ClockCounterClockwise size={28} weight="duotone" color="var(--t-text-muted)" />
        <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>No changes recorded yet.</p>
      </div>
    )

  return (
    <div
      style={{ border: '1px solid var(--t-border-subtle)', borderRadius: 10, overflow: 'hidden' }}
    >
      {history.map((h, i) => (
        <div
          key={h.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '12px 16px',
            borderTop: i > 0 ? '1px solid var(--t-border-subtle)' : 'none',
          }}
        >
          <ClockCounterClockwise
            size={13}
            color="var(--t-text-muted)"
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>
              <span style={{ color: 'var(--t-text-primary)', fontWeight: 500 }}>{h.field}</span>{' '}
              changed by {h.changedBy}
            </p>
            <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 3 }}>
              <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>
                {h.oldValue ?? '(empty)'}
              </span>
              {' → '}
              {h.newValue ?? '(empty)'}
            </p>
          </div>
          <span style={{ fontSize: 11, color: 'var(--t-text-muted)', flexShrink: 0 }}>
            {new Date(h.changedAt).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function TestEditor({
  folderId,
  testId: initialTestId,
  appId,
  spaceId,
  onNavigate,
  onSaved,
}: Props) {
  const [internalTestId, setInternalTestId] = useState<number | undefined>(initialTestId)
  const [test, setTest] = useState<TestDetail | null>(null)
  const [loading, setLoading] = useState(!!initialTestId)
  const [tab, setTab] = useState<'details' | 'steps' | 'history'>('details')

  const [type, setType] = useState<'traditional' | 'bdd'>('traditional')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [preconditions, setPreconditions] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<TestPriority>('Medium')
  const [status, setStatus] = useState<TestStatus>('Draft')
  const [category, setCategory] = useState<TestType | ''>('')
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | ''>('')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [jiraIssueKey, setJiraIssueKey] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [globalTagList, setGlobalTagList] = useState<GlobalTag[]>([])
  const [spaceTagList, setSpaceTagList] = useState<SpaceTag[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customValues, setCustomValues] = useState<Record<number, string>>({})

  useEffect(() => {
    setInternalTestId(initialTestId)
  }, [initialTestId])

  useEffect(() => {
    api.fields
      .list(appId)
      .then((fields) => setCustomFields(fields.sort((a, b) => a.order - b.order)))
      .catch(() => {})
    api.globalTags
      .list()
      .then(setGlobalTagList)
      .catch(() => {})
    api.spaceTags
      .list(spaceId)
      .then(setSpaceTagList)
      .catch(() => {})
  }, [appId, spaceId])

  useEffect(() => {
    if (!internalTestId) return
    api.fields.values
      .list(appId, internalTestId)
      .then((vals) => {
        const map: Record<number, string> = {}
        for (const v of vals) map[v.fieldId] = v.value ?? ''
        setCustomValues(map)
      })
      .catch(() => {})
  }, [appId, internalTestId])

  const loadTest = async (id = internalTestId) => {
    if (!id) return
    setLoading(true)
    try {
      const t = await api.tests.get(folderId, id)
      setTest(t)
      setType(t.type)
      setTitle(t.title)
      setDescription(t.description ?? '')
      setPreconditions(t.preconditions ?? '')
      setNotes(t.notes ?? '')
      setPriority(t.priority)
      setStatus(t.status)
      setCategory((t.category as TestType) ?? '')
      setAutomationStatus((t.automationStatus as AutomationStatus) ?? '')
      setEstimatedTime(t.estimatedTime != null ? String(t.estimatedTime) : '')
      setJiraIssueKey(t.jiraIssueKey ?? '')
      setAssigneeId(t.assigneeId ?? '')
      setTags(t.tags ? (JSON.parse(t.tags) as string[]) : [])
    } finally {
      setLoading(false)
    }
  }

  // Only refreshes steps/scenarios without touching form field state
  const refreshTestData = async (id = internalTestId) => {
    if (!id) return
    const t = await api.tests.get(folderId, id)
    setTest(t)
  }

  useEffect(() => {
    loadTest()
  }, [internalTestId])

  const saveTest = async (): Promise<number | undefined> => {
    if (!title.trim()) {
      setError('Title is required')
      return undefined
    }
    setSaving(true)
    setError('')
    const payload = {
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      preconditions: preconditions.trim() || undefined,
      notes: notes.trim() || undefined,
      priority,
      status,
      category: (category as TestType) || undefined,
      automationStatus: (automationStatus as AutomationStatus) || undefined,
      estimatedTime: estimatedTime ? parseInt(estimatedTime, 10) : undefined,
      jiraIssueKey: jiraIssueKey.trim() || undefined,
      assigneeId: assigneeId.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    }
    try {
      if (internalTestId) {
        await api.tests.update(folderId, internalTestId, { ...payload, updatedBy: CURRENT_USER })
        onSaved()
        onNavigate({ type: 'tests', appId, spaceId, folderId })
        return internalTestId
      } else {
        const created = await api.tests.create(folderId, { ...payload, createdBy: CURRENT_USER })
        setInternalTestId(created.id)
        setTest({ ...created, steps: [], scenarios: [] })
        onSaved()
        onNavigate({ type: 'tests', appId, spaceId, folderId })
        return created.id
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      return undefined
    } finally {
      setSaving(false)
    }
  }

  const saveAndNext = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      preconditions: preconditions.trim() || undefined,
      notes: notes.trim() || undefined,
      priority,
      status,
      category: (category as TestType) || undefined,
      automationStatus: (automationStatus as AutomationStatus) || undefined,
      estimatedTime: estimatedTime ? parseInt(estimatedTime, 10) : undefined,
      jiraIssueKey: jiraIssueKey.trim() || undefined,
      assigneeId: assigneeId.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    }
    try {
      const created = await api.tests.create(folderId, { ...payload, createdBy: CURRENT_USER })
      setInternalTestId(created.id)
      setTest({ ...created, steps: [], scenarios: [] })
      onSaved()
      setTab('steps')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleTabSwitch = (newTab: typeof tab) => {
    if (isNew && !internalTestId && newTab === 'steps') {
      setError("Click 'Save & Next' to save details before adding steps")
      return
    }
    setTab(newTab)
    setError('')
  }

  const isNew = !internalTestId

  if (loading)
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--t-bg-base)',
          color: 'var(--t-text-muted)',
          fontSize: 13,
        }}
      >
        Loading…
      </div>
    )

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
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 20px',
          height: 52,
          borderBottom: '1px solid var(--t-border-subtle)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => onNavigate({ type: 'tests', appId, spaceId, folderId })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--t-text-secondary)',
            fontSize: 13,
            flexShrink: 0,
            transition: 'all 0.1s',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(255,255,255,0.05)'
            el.style.color = 'var(--t-text-primary)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'
            el.style.color = 'var(--t-text-secondary)'
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div
          style={{ width: 1, height: 16, background: 'var(--t-border-subtle)', flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>
          {isNew ? 'New Test' : `Edit Test #${internalTestId}`}
        </span>
      </div>

      {/* ── Tabs + actions ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          borderBottom: '1px solid var(--t-border-subtle)',
          flexShrink: 0,
        }}
      >
        {/* Tab buttons */}
        <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1 }}>
          {(isNew
            ? (['details', 'steps'] as const)
            : (['details', 'steps', 'history'] as const)
          ).map((t) => {
            const active = tab === t
            const label =
              t === 'steps'
                ? type === 'bdd'
                  ? 'Scenarios'
                  : 'Steps'
                : t === 'details'
                  ? 'Details'
                  : 'History'
            return (
              <button
                key={t}
                onClick={() => handleTabSwitch(t)}
                style={{
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  border: 'none',
                  borderBottom: active
                    ? '2px solid var(--t-text-primary)'
                    : '2px solid transparent',
                  background: 'transparent',
                  color: active ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
                  cursor: 'pointer',
                  transition: 'color 0.1s',
                  marginBottom: -1,
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--t-text-muted)'
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
        {/* Save / Cancel */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 1 }}>
          {error && <span style={{ fontSize: 12, color: 'var(--t-accent-danger)' }}>{error}</span>}
          <Button
            variant="outline"
            onClick={() => onNavigate({ type: 'tests', appId, spaceId, folderId })}
            style={{ height: 32, fontSize: 12 }}
          >
            Cancel
          </Button>
          {isNew && !internalTestId ? (
            <Button
              onClick={saveAndNext}
              disabled={saving}
              style={{ gap: 6, height: 32, fontSize: 12 }}
            >
              <FloppyDisk size={13} weight="bold" />
              {saving ? 'Saving…' : 'Save & Next'}
            </Button>
          ) : (
            <Button
              onClick={saveTest}
              disabled={saving}
              style={{ gap: 6, height: 32, fontSize: 12 }}
            >
              <FloppyDisk size={13} weight="bold" />
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* ── Details ── */}
        {tab === 'details' && (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* Left column — main fields */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '28px 28px 28px 32px',
                borderRight: '1px solid var(--t-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              <Field label="Title *">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What does this test verify?"
                  autoFocus={isNew}
                />
              </Field>
              <Field label="Description">
                <RichEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Additional context about this test…"
                  minHeight={120}
                />
              </Field>
              <Field label="Preconditions">
                <RichEditor
                  value={preconditions}
                  onChange={setPreconditions}
                  placeholder="What must be true before running this test?"
                  minHeight={90}
                />
              </Field>
              <Field label="Notes">
                <RichEditor
                  value={notes}
                  onChange={setNotes}
                  placeholder="Known issues, edge cases, reminders…"
                  minHeight={90}
                />
              </Field>
            </div>

            {/* Right column — metadata */}
            <div
              style={{
                width: 400,
                flexShrink: 0,
                overflowY: 'auto',
                padding: '28px 24px 28px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              <Field label="Test type">
                <div style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
                  {(['traditional', 'bdd'] as const).map((t) => {
                    const on = type === t
                    return (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 12px',
                          borderRadius: 7,
                          border: '1px solid',
                          borderColor: on ? 'var(--t-border-default)' : 'var(--t-border-subtle)',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: on ? 500 : 400,
                          background: on ? 'var(--t-bg-elevated)' : 'transparent',
                          color: on ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
                          transition: 'all 0.1s',
                          textAlign: 'left',
                        }}
                      >
                        {t === 'bdd' ? <GitBranch size={13} /> : <ListChecks size={13} />}
                        {t === 'bdd' ? 'BDD / Gherkin' : 'Traditional'}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <Field label="Category">
                <Select value={category} onChange={(v) => setCategory(v as TestType | '')}>
                  <option value="">— None —</option>
                  <option value="Functional">Functional</option>
                  <option value="Manual">Manual</option>
                  <option value="Regression">Regression</option>
                  <option value="Smoke & Sanity">Smoke &amp; Sanity</option>
                  <option value="Acceptance">Acceptance</option>
                  <option value="Accessibility">Accessibility</option>
                  <option value="Compatibility">Compatibility</option>
                  <option value="Destructive">Destructive</option>
                  <option value="Integration">Integration</option>
                  <option value="Performance">Performance</option>
                  <option value="Security">Security</option>
                  <option value="User Interface">User Interface</option>
                  <option value="Usability">Usability</option>
                  <option value="Other">Other</option>
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={priority} onChange={(v) => setPriority(v as TestPriority)}>
                  <option value="Lowest">Lowest</option>
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Highest">Highest</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={status} onChange={(v) => setStatus(v as TestStatus)}>
                  <option value="Draft">Draft</option>
                  <option value="Unverified">Unverified</option>
                  <option value="Faulty">Faulty</option>
                  <option value="Ready">Ready</option>
                  <option value="Live">Live</option>
                  <option value="Deprecated">Deprecated</option>
                  <option value="Archived">Archived</option>
                </Select>
              </Field>
              <Field label="Automation Status">
                <Select
                  value={automationStatus}
                  onChange={(v) => setAutomationStatus(v as AutomationStatus | '')}
                >
                  <option value="">— None —</option>
                  <option value="Not Automated">Not Automated</option>
                  <option value="To Be Automated">To Be Automated</option>
                  <option value="Automated">Automated</option>
                </Select>
              </Field>
              <Field label="Estimated Time (minutes)">
                <Input
                  type="number"
                  min="0"
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                  placeholder="e.g. 30"
                />
              </Field>
              <Field label="Jira Issue Key">
                <Input
                  value={jiraIssueKey}
                  onChange={(e) => setJiraIssueKey(e.target.value)}
                  placeholder="e.g. PROJ-123"
                />
              </Field>
              <Field label="Assignee">
                <Input
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  placeholder="user@example.com"
                />
              </Field>
              <Field label="Tags">
                <TagPicker
                  selected={tags}
                  onChange={setTags}
                  globalTags={globalTagList}
                  spaceTags={spaceTagList}
                  onCreateSpaceTag={async (name) => {
                    try {
                      const created = await api.spaceTags.create(spaceId, { name })
                      setSpaceTagList((prev) => [...prev, created])
                      return created
                    } catch {
                      return null
                    }
                  }}
                />
              </Field>

              {/* ── Custom fields ── */}
              {customFields.length > 0 && (
                <>
                  <div style={{ borderTop: '1px solid var(--t-border-subtle)', paddingTop: 20 }}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--t-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 14,
                      }}
                    >
                      Custom Fields
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {customFields.map((f) => {
                        const val = customValues[f.id] ?? f.defaultValue ?? ''
                        const onChange = async (v: string) => {
                          setCustomValues((prev) => ({ ...prev, [f.id]: v }))
                          if (internalTestId) {
                            await api.fields.values
                              .set(appId, internalTestId, f.id, v)
                              .catch(() => {})
                          }
                        }
                        let opts: string[] = []
                        try {
                          opts = f.options ? (JSON.parse(f.options) as string[]) : []
                        } catch {
                          /* ignore JSON parse errors */
                        }

                        return (
                          <Field key={f.id} label={f.name + (f.required ? ' *' : '')}>
                            {f.type === 'text' && (
                              <Input
                                value={val}
                                onChange={(e) => onChange(e.target.value)}
                                placeholder={f.defaultValue ?? ''}
                              />
                            )}
                            {f.type === 'number' && (
                              <Input
                                value={val}
                                onChange={(e) => onChange(e.target.value)}
                                placeholder="0"
                              />
                            )}
                            {f.type === 'url' && (
                              <Input
                                value={val}
                                onChange={(e) => onChange(e.target.value)}
                                placeholder="https://"
                              />
                            )}
                            {f.type === 'date' && (
                              <Input
                                value={val}
                                onChange={(e) => onChange(e.target.value)}
                                placeholder="YYYY-MM-DD"
                              />
                            )}
                            {f.type === 'checkbox' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={val === 'true'}
                                  onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
                                  style={{ width: 14, height: 14, cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>
                                  {val === 'true' ? 'Yes' : 'No'}
                                </span>
                              </div>
                            )}
                            {f.type === 'dropdown' && (
                              <Select value={val} onChange={onChange}>
                                <option value="">— Select —</option>
                                {opts.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </Select>
                            )}
                            {f.type === 'multiselect' && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {opts.map((o) => {
                                  const selected = val
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                    .includes(o)
                                  const toggle = () => {
                                    const current = val
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                    const next = selected
                                      ? current.filter((c) => c !== o)
                                      : [...current, o]
                                    onChange(next.join(', '))
                                  }
                                  return (
                                    <button
                                      key={o}
                                      onClick={toggle}
                                      style={{
                                        padding: '3px 10px',
                                        borderRadius: 99,
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        border: '1px solid',
                                        background: selected
                                          ? 'rgba(255,255,255,0.08)'
                                          : 'transparent',
                                        color: selected
                                          ? 'var(--t-text-primary)'
                                          : 'var(--t-text-muted)',
                                        borderColor: selected
                                          ? 'var(--t-border-strong)'
                                          : 'var(--t-border-default)',
                                        transition: 'all 0.1s',
                                      }}
                                    >
                                      {o}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </Field>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Steps / Scenarios ── */}
        {tab === 'steps' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
              {!internalTestId ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '64px 0',
                    color: 'var(--t-text-muted)',
                    fontSize: 13,
                  }}
                >
                  <p>
                    Go to the{' '}
                    <button
                      onClick={() => {
                        setTab('details')
                        setError('')
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--t-text-secondary)',
                        textDecoration: 'underline',
                        fontSize: 13,
                        padding: 0,
                      }}
                    >
                      Details
                    </button>{' '}
                    tab and click{' '}
                    <span style={{ color: 'var(--t-text-primary)', fontWeight: 500 }}>
                      Save &amp; Next
                    </span>{' '}
                    first.
                  </p>
                </div>
              ) : type === 'traditional' ? (
                <TraditionalSteps
                  steps={test?.steps ?? []}
                  folderId={folderId}
                  testId={internalTestId}
                  onRefresh={() => refreshTestData(internalTestId) as Promise<void>}
                />
              ) : (
                <BddScenarios
                  scenarios={test?.scenarios ?? []}
                  folderId={folderId}
                  testId={internalTestId}
                  onRefresh={() => refreshTestData(internalTestId)}
                />
              )}
            </div>
          </div>
        )}

        {/* ── History ── */}
        {tab === 'history' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
              {internalTestId ? (
                <HistoryTab folderId={folderId} testId={internalTestId} />
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '64px 0',
                    color: 'var(--t-text-muted)',
                    fontSize: 13,
                  }}
                >
                  Save the test to view history.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
