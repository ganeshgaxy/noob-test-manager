import { useState, useEffect, useCallback, useRef } from 'react'
import {
  SlidersHorizontal,
  Tag,
  Palette,
  PlugsConnected,
  Plus,
  Trash,
  PencilSimple,
  Check,
  X,
  GithubLogo,
  SlackLogo,
  Globe,
  ArrowUp,
  ArrowDown,
  Users,
  UserPlus,
  Crown,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button.js'
import { api } from '../../lib/api.js'
import { useAuth } from '../../contexts/AuthContext.js'
import { SkeletonBlock, SkeletonRows } from '@/components/ui/skeleton.js'
import type {
  CustomField,
  AppSettings,
  AppIntegration,
  AppMember,
  AppGroupAccess,
  Group,
} from '../../types/index.js'

// ─── Shared helpers ───────────────────────────────────────────────────────────

const FIELD_TYPES = [
  'text',
  'number',
  'dropdown',
  'multiselect',
  'date',
  'checkbox',
  'url',
] as const
const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  dropdown: 'Dropdown',
  multiselect: 'Multi-select',
  date: 'Date',
  checkbox: 'Checkbox',
  url: 'URL',
}

const DEFAULT_PRIORITIES = ['low', 'medium', 'high', 'critical']
const DEFAULT_STATUSES = ['draft', 'active', 'deprecated']

const BASE_PRIORITY_COLORS: Record<string, string> = {
  low: '#555',
  medium: '#eab308',
  high: '#f97316',
  critical: '#e5484d',
}
const BASE_STATUS_COLORS: Record<string, string> = {
  draft: '#555',
  active: '#22c55e',
  deprecated: '#888',
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--t-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--t-bg-surface)',
        border: '1px solid var(--t-border-subtle)',
        borderRadius: 8,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function IconBtn({
  icon,
  onClick,
  danger = false,
  title,
}: {
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
  title?: string
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        border: 'none',
        borderRadius: 6,
        background: 'transparent',
        color: 'var(--t-text-muted)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.1s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = danger ? 'rgba(229,72,77,0.1)' : 'var(--t-bg-elevated)'
        el.style.color = danger ? 'var(--t-accent-danger)' : 'var(--t-text-secondary)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'transparent'
        el.style.color = 'var(--t-text-muted)'
      }}
    >
      {icon}
    </button>
  )
}

function Input({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: 'var(--t-bg-panel)',
        border: '1px solid var(--t-border-default)',
        borderRadius: 6,
        color: 'var(--t-text-primary)',
        fontSize: 13,
        padding: '6px 10px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--t-border-strong)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--t-border-default)')}
    />
  )
}

function Select({
  value,
  onChange,
  children,
  style,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--t-bg-panel)',
        border: '1px solid var(--t-border-default)',
        borderRadius: 6,
        color: 'var(--t-text-primary)',
        fontSize: 13,
        padding: '6px 10px',
        outline: 'none',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </select>
  )
}

// ─── Tab: Custom Fields ───────────────────────────────────────────────────────

interface FieldFormState {
  name: string
  type: string
  options: string
  required: boolean
  defaultValue: string
}

const emptyForm = (): FieldFormState => ({
  name: '',
  type: 'text',
  options: '',
  required: false,
  defaultValue: '',
})

function CustomFieldsTab({ appId }: { appId: number }) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FieldFormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const data = await api.fields.list(appId)
    setFields(data.sort((a, b) => a.order - b.order))
  }, [appId])

  useEffect(() => {
    load()
  }, [load])

  const startEdit = (f: CustomField) => {
    setEditing(f.id)
    setAdding(false)
    setForm({
      name: f.name,
      type: f.type,
      options: f.options ? (JSON.parse(f.options) as string[]).join(', ') : '',
      required: f.required,
      defaultValue: f.defaultValue ?? '',
    })
  }

  const cancel = () => {
    setEditing(null)
    setAdding(false)
    setForm(emptyForm())
  }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      type: form.type,
      options: ['dropdown', 'multiselect'].includes(form.type)
        ? form.options
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      required: form.required,
      defaultValue: form.defaultValue || undefined,
    }
    if (adding) {
      await api.fields.create(appId, payload)
    } else if (editing !== null) {
      await api.fields.update(appId, editing, payload)
    }
    await load()
    cancel()
    setSaving(false)
  }

  const remove = async (id: number) => {
    await api.fields.delete(appId, id)
    await load()
  }

  const moveField = async (id: number, dir: -1 | 1) => {
    const idx = fields.findIndex((f) => f.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= fields.length) return
    const reordered = [...fields]
    ;[reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]]
    await Promise.all(reordered.map((f, i) => api.fields.update(appId, f.id, { order: i })))
    await load()
  }

  const FormPanel = (
    <Card style={{ marginBottom: 16 }}>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--t-text-secondary)',
          marginBottom: 14,
        }}
      >
        {adding ? 'New Field' : 'Edit Field'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--t-text-secondary)', marginBottom: 5 }}>
            Field name
          </p>
          <Input
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Automation Status"
          />
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--t-text-secondary)', marginBottom: 5 }}>Type</p>
          <Select value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))}>
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {['dropdown', 'multiselect'].includes(form.type) && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--t-text-secondary)', marginBottom: 5 }}>
            Options <span style={{ color: 'var(--t-text-muted)' }}>(comma-separated)</span>
          </p>
          <Input
            value={form.options}
            onChange={(v) => setForm((f) => ({ ...f, options: v }))}
            placeholder="Option A, Option B, Option C"
          />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--t-text-secondary)', marginBottom: 5 }}>
            Default value
          </p>
          <Input
            value={form.defaultValue}
            onChange={(v) => setForm((f) => ({ ...f, defaultValue: v }))}
            placeholder="Optional"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
          <input
            type="checkbox"
            id="req"
            checked={form.required}
            onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
            style={{ width: 14, height: 14, cursor: 'pointer' }}
          />
          <label
            htmlFor="req"
            style={{ fontSize: 13, color: 'var(--t-text-secondary)', cursor: 'pointer' }}
          >
            Required field
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" onClick={save} disabled={saving} style={{ gap: 5 }}>
          <Check size={12} /> {saving ? 'Saving…' : 'Save Field'}
        </Button>
        <Button size="sm" variant="outline" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </Card>
  )

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <SectionHeader>Custom Fields</SectionHeader>
        {!adding && editing === null && (
          <Button
            size="sm"
            onClick={() => {
              setAdding(true)
              setEditing(null)
              setForm(emptyForm())
            }}
            style={{ gap: 5 }}
          >
            <Plus size={12} /> Add Field
          </Button>
        )}
      </div>

      {(adding || editing !== null) && FormPanel}

      {fields.length === 0 && !adding ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 0',
            color: 'var(--t-text-muted)',
            fontSize: 13,
          }}
        >
          No custom fields yet. Add one to extend every test.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fields.map((f, _i) => (
            <Card
              key={f.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <IconBtn
                  icon={<ArrowUp size={11} />}
                  onClick={() => moveField(f.id, -1)}
                  title="Move up"
                />
                <IconBtn
                  icon={<ArrowDown size={11} />}
                  onClick={() => moveField(f.id, 1)}
                  title="Move down"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-text-primary)' }}>
                    {f.name}
                  </span>
                  {f.required && (
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--t-accent-danger)',
                        background: 'rgba(229,72,77,0.1)',
                        border: '1px solid rgba(229,72,77,0.2)',
                        borderRadius: 4,
                        padding: '1px 5px',
                      }}
                    >
                      required
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--t-text-secondary)' }}>
                    {FIELD_TYPE_LABELS[f.type]}
                  </span>
                  {f.defaultValue && (
                    <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                      default: {f.defaultValue}
                    </span>
                  )}
                  {f.options &&
                    (() => {
                      try {
                        const opts = JSON.parse(f.options) as string[]
                        return (
                          <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                            {opts.join(' · ')}
                          </span>
                        )
                      } catch {
                        return null
                      }
                    })()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <IconBtn
                  icon={<PencilSimple size={13} />}
                  onClick={() => startEdit(f)}
                  title="Edit"
                />
                <IconBtn
                  icon={<Trash size={13} />}
                  onClick={() => remove(f.id)}
                  danger
                  title="Delete"
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Defaults ────────────────────────────────────────────────────────────

function DefaultsTab({ appId }: { appId: number }) {
  const [settings, setSettings] = useState<AppSettings>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    api.settings
      .get(appId)
      .then(setSettings)
      .catch(() => setSettings({}))
  }, [appId])

  const save = async (key: string, value: unknown) => {
    setSaving(key)
    await api.settings.set(appId, key, value)
    setSettings((s) => ({ ...s, [key]: value }))
    setSaving(null)
  }

  const row = (label: string, key: keyof AppSettings, children: React.ReactNode) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--t-border-subtle)',
      }}
    >
      <div>
        <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{label}</p>
        {saving === key && (
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 2 }}>Saving…</p>
        )}
      </div>
      {children}
    </div>
  )

  return (
    <div>
      <SectionHeader>Test Defaults</SectionHeader>
      <Card>
        {row(
          'Default Priority',
          'defaultPriority',
          <Select
            value={settings.defaultPriority ?? 'medium'}
            onChange={(v) => save('defaultPriority', v)}
            style={{ width: 160 }}
          >
            {DEFAULT_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </Select>
        )}
        {row(
          'Default Status',
          'defaultStatus',
          <Select
            value={settings.defaultStatus ?? 'draft'}
            onChange={(v) => save('defaultStatus', v)}
            style={{ width: 160 }}
          >
            {DEFAULT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        )}
        {row(
          'Default Assignee',
          'defaultAssignee',
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              value={settings.defaultAssignee ?? ''}
              onChange={(v) => setSettings((s) => ({ ...s, defaultAssignee: v }))}
              placeholder="email or name"
              style={{ width: 200 }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => save('defaultAssignee', settings.defaultAssignee ?? '')}
            >
              Save
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Tab: Tags ────────────────────────────────────────────────────────────────

function TagsTab({ appId }: { appId: number }) {
  const [tags, setTags] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.settings
      .get(appId)
      .then((s) => {
        setTags(s.tags ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [appId])

  const saveTags = async (updated: string[]) => {
    await api.settings.set(appId, 'tags', updated)
    setTags(updated)
  }

  const addTag = async () => {
    const t = input.trim()
    if (!t || tags.includes(t)) return
    await saveTags([...tags, t])
    setInput('')
  }

  const removeTag = async (tag: string) => {
    await saveTags(tags.filter((t) => t !== tag))
  }

  if (loading) return <SkeletonBlock lines={4} style={{ marginTop: 8 }} />

  return (
    <div>
      <SectionHeader>Tags Library</SectionHeader>
      <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginBottom: 16 }}>
        Define the tag palette for this app. Tests can only use tags from this list.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addTag()
          }}
          placeholder="New tag…"
          style={{
            background: 'var(--t-bg-panel)',
            border: '1px solid var(--t-border-default)',
            borderRadius: 6,
            color: 'var(--t-text-primary)',
            fontSize: 13,
            padding: '8px 12px',
            outline: 'none',
            width: 280,
            boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--t-border-strong)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--t-border-default)')}
        />
        <Button onClick={addTag} style={{ gap: 6, height: 36, flexShrink: 0 }}>
          <Plus size={13} /> Add Tag
        </Button>
      </div>
      {tags.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 0',
            color: 'var(--t-text-muted)',
            fontSize: 13,
          }}
        >
          No tags yet. Add some to curate the tag library for tests.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tags.map((tag) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--t-bg-panel)',
                border: '1px solid var(--t-border-default)',
                borderRadius: 99,
                padding: '5px 12px',
                fontSize: 12,
                color: 'var(--t-text-secondary)',
              }}
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--t-text-muted)',
                  padding: 0,
                  display: 'flex',
                  transition: 'color 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t-accent-danger)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t-text-muted)')}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Labels (status & priority display names + colors) ──────────────────

function LabelsTab({ appId }: { appId: number }) {
  const [settings, setSettings] = useState<AppSettings>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.settings
      .get(appId)
      .then(setSettings)
      .catch(() => {})
  }, [appId])

  const statusLabels = settings.statusLabels ?? {}
  const priorityLabels = settings.priorityLabels ?? {}

  const updateStatusLabel = (key: string, field: 'label' | 'color', val: string) => {
    setSettings((s) => ({
      ...s,
      statusLabels: {
        ...s.statusLabels,
        [key]: {
          label: s.statusLabels?.[key]?.label ?? key,
          color: s.statusLabels?.[key]?.color ?? BASE_STATUS_COLORS[key],
          [field]: val,
        },
      },
    }))
  }

  const updatePriorityLabel = (key: string, field: 'label' | 'color', val: string) => {
    setSettings((s) => ({
      ...s,
      priorityLabels: {
        ...s.priorityLabels,
        [key]: {
          label: s.priorityLabels?.[key]?.label ?? key,
          color: s.priorityLabels?.[key]?.color ?? BASE_PRIORITY_COLORS[key],
          [field]: val,
        },
      },
    }))
  }

  const saveAll = async () => {
    setSaving(true)
    await Promise.all([
      api.settings.set(appId, 'statusLabels', settings.statusLabels ?? {}),
      api.settings.set(appId, 'priorityLabels', settings.priorityLabels ?? {}),
    ])
    setSaving(false)
  }

  const LabelRow = ({
    keys,
    defaults,
    labels,
    onUpdate,
  }: {
    keys: string[]
    defaults: Record<string, string>
    labels: Record<string, { label: string; color: string }>
    onUpdate: (key: string, field: 'label' | 'color', val: string) => void
  }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {keys.map((k) => {
        const lbl = labels[k]?.label ?? k
        const clr = labels[k]?.color ?? defaults[k]
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontSize: 11,
                color: 'var(--t-text-secondary)',
                width: 80,
                textTransform: 'capitalize',
              }}
            >
              {k}
            </span>
            <input
              type="color"
              value={clr}
              onChange={(e) => onUpdate(k, 'color', e.target.value)}
              style={{
                width: 32,
                height: 28,
                border: '1px solid var(--t-border-default)',
                borderRadius: 6,
                cursor: 'pointer',
                background: 'transparent',
                padding: 2,
              }}
            />
            <Input
              value={lbl}
              onChange={(v) => onUpdate(k, 'label', v)}
              style={{ maxWidth: 200 }}
            />
            <span
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--t-bg-panel)',
                color: clr,
                border: `1px solid ${clr}40`,
              }}
            >
              {lbl}
            </span>
          </div>
        )
      })}
    </div>
  )

  return (
    <div>
      <SectionHeader>Status Labels</SectionHeader>
      <Card style={{ marginBottom: 20 }}>
        <LabelRow
          keys={DEFAULT_STATUSES}
          defaults={BASE_STATUS_COLORS}
          labels={statusLabels}
          onUpdate={updateStatusLabel}
        />
      </Card>
      <SectionHeader>Priority Labels</SectionHeader>
      <Card style={{ marginBottom: 20 }}>
        <LabelRow
          keys={DEFAULT_PRIORITIES}
          defaults={BASE_PRIORITY_COLORS}
          labels={priorityLabels}
          onUpdate={updatePriorityLabel}
        />
      </Card>
      <Button onClick={saveAll} disabled={saving} style={{ gap: 5 }}>
        <Check size={13} /> {saving ? 'Saving…' : 'Save Labels'}
      </Button>
    </div>
  )
}

// ─── Tab: Members ─────────────────────────────────────────────────────────────

type MemberRole = 'admin' | 'member' | 'viewer'

const ROLE_COLORS: Record<MemberRole, string> = {
  admin: 'var(--t-text-primary)',
  member: 'var(--t-accent-success)',
  viewer: 'var(--t-text-secondary)',
}

const ROLE_BADGE_STYLES: Record<MemberRole, { color: string; background: string; border: string }> =
  {
    admin: {
      color: 'var(--t-text-primary)',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.15)',
    },
    member: {
      color: 'var(--t-accent-success)',
      background: 'rgba(34,197,94,0.08)',
      border: '1px solid rgba(34,197,94,0.2)',
    },
    viewer: {
      color: 'var(--t-text-secondary)',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
    },
  }

function RoleBadge({ role }: { role: MemberRole }) {
  const s = ROLE_BADGE_STYLES[role]
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: s.color,
        background: s.background,
        border: s.border,
        borderRadius: 4,
        padding: '2px 7px',
      }}
    >
      {role}
    </span>
  )
}

// ─── Group Access Section (inside MembersTab) ─────────────────────────────────

function GroupAccessSection({ appId, canManage }: { appId: number; canManage: boolean }) {
  const [groupAccess, setGroupAccess] = useState<AppGroupAccess[]>([])
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('')
  const [addRole, setAddRole] = useState<MemberRole>('member')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [access, groups] = await Promise.all([
        api.members.appGroups.list(appId),
        api.groups.list(),
      ])
      setGroupAccess(access)
      setAllGroups(groups)
    } finally {
      setLoading(false)
    }
  }, [appId])

  useEffect(() => {
    void load()
  }, [load])

  const handleAdd = async () => {
    if (!selectedGroupId) return
    setAdding(true)
    setError(null)
    try {
      await api.members.appGroups.add(appId, Number(selectedGroupId), addRole)
      await load()
      setAddOpen(false)
      setSelectedGroupId('')
      setAddRole('member')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add group')
    } finally {
      setAdding(false)
    }
  }

  const handleRoleChange = async (groupId: number, role: MemberRole) => {
    await api.members.appGroups.update(appId, groupId, role)
    await load()
  }

  const handleRemove = async (groupId: number) => {
    await api.members.appGroups.remove(appId, groupId)
    await load()
  }

  const existingGroupIds = new Set(groupAccess.map((g) => g.groupId))
  const availableGroups = allGroups.filter((g) => !existingGroupIds.has(g.id))

  if (loading) return <SkeletonRows count={3} rowHeight={44} padding="8px 0" showIcon={false} />

  return (
    <div style={{ marginTop: 28 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <SectionHeader>Group Access</SectionHeader>
        {canManage && !addOpen && (
          <Button size="sm" onClick={() => setAddOpen(true)} style={{ gap: 5 }}>
            <Plus size={13} /> Add Group
          </Button>
        )}
      </div>
      {addOpen && (
        <Card
          style={{
            padding: '12px 14px',
            marginBottom: 12,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {availableGroups.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--t-text-muted)',
                fontStyle: 'italic',
                flex: 1,
              }}
            >
              {allGroups.length === 0
                ? 'No groups exist yet — go to User Management → User Groups to create one.'
                : 'All groups already have access to this app.'}
            </p>
          ) : (
            <>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(Number(e.target.value) || '')}
                style={{
                  background: 'var(--t-bg-panel)',
                  border: '1px solid var(--t-border-default)',
                  borderRadius: 6,
                  color: 'var(--t-text-secondary)',
                  fontSize: 13,
                  padding: '5px 8px',
                  flex: 1,
                  minWidth: 160,
                }}
              >
                <option value="">Select group…</option>
                {availableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as MemberRole)}
                style={{
                  background: 'var(--t-bg-panel)',
                  border: '1px solid var(--t-border-default)',
                  borderRadius: 6,
                  color: 'var(--t-text-secondary)',
                  fontSize: 13,
                  padding: '5px 8px',
                  width: 110,
                }}
              >
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button
                size="sm"
                disabled={adding || !selectedGroupId}
                onClick={() => void handleAdd()}
                style={{ gap: 5 }}
              >
                <Check size={12} /> {adding ? 'Adding…' : 'Add'}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddOpen(false)
              setError(null)
            }}
          >
            Cancel
          </Button>
          {error && (
            <p style={{ fontSize: 12, color: 'var(--t-accent-danger)', margin: 0, width: '100%' }}>
              {error}
            </p>
          )}
        </Card>
      )}
      {groupAccess.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '24px 0',
            color: 'var(--t-text-muted)',
            fontSize: 13,
          }}
        >
          No groups have access to this app yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {groupAccess.map((g) => (
            <Card
              key={g.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--t-bg-elevated)',
                  border: '1px solid var(--t-border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Users size={15} color="var(--t-text-muted)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--t-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {g.groupName}
                </p>
                {g.groupDescription && (
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', margin: 0 }}>
                    {g.groupDescription}
                  </p>
                )}
              </div>
              {canManage ? (
                <select
                  value={g.role}
                  onChange={(e) => void handleRoleChange(g.groupId, e.target.value as MemberRole)}
                  style={{
                    background: 'var(--t-bg-panel)',
                    border: '1px solid var(--t-border-default)',
                    borderRadius: 6,
                    color: ROLE_COLORS[g.role],
                    fontSize: 12,
                    padding: '4px 8px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <RoleBadge role={g.role} />
              )}
              {canManage && (
                <IconBtn
                  icon={<Trash size={13} />}
                  onClick={() => void handleRemove(g.groupId)}
                  danger
                  title="Remove group access"
                />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function MembersTab({ appId }: { appId: number }) {
  const { user: authUser } = useAuth()
  const [members, setMembers] = useState<AppMember[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)

  // Add-member form state
  const [addOpen, setAddOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<
    { id: number; email: string; name: string | null }[]
  >([])
  const [selectedUser, setSelectedUser] = useState<{
    id: number
    email: string
    name: string | null
  } | null>(null)
  const [addRole, setAddRole] = useState<MemberRole>('member')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isSuperAdmin = authUser?.globalRole === 'super_admin'
  const myMembership = members.find((m) => m.userId === authUser?.id)
  const canManage = isSuperAdmin || myMembership?.role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.members.app.list(appId)
      setMembers(data)
    } finally {
      setLoading(false)
    }
  }, [appId])

  useEffect(() => {
    void load()
  }, [load])

  const handleRoleChange = async (userId: number, role: MemberRole) => {
    setUpdatingId(userId)
    try {
      await api.members.app.update(appId, userId, role)
      await load()
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRemove = async (userId: number) => {
    setRemovingId(userId)
    try {
      await api.members.app.remove(appId, userId)
      await load()
    } finally {
      setRemovingId(null)
    }
  }

  // Debounced user search
  const handleSearch = (q: string) => {
    setSearchQ(q)
    setSelectedUser(null)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    searchTimerRef.current = setTimeout(() => {
      void api.users.search(q).then(setSearchResults)
    }, 300)
  }

  const handleAdd = async () => {
    if (!selectedUser) {
      setAddError('Select a user from search results')
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      await api.members.app.add(appId, selectedUser.id, addRole)
      await load()
      setAddOpen(false)
      setSearchQ('')
      setSearchResults([])
      setSelectedUser(null)
      setAddRole('member')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setAdding(false)
    }
  }

  const existingUserIds = new Set(members.map((m) => m.userId))

  if (loading) return <SkeletonRows count={4} rowHeight={48} padding="10px 0" />

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <SectionHeader>App Members</SectionHeader>
        {canManage && !addOpen && (
          <Button size="sm" onClick={() => setAddOpen(true)} style={{ gap: 5 }}>
            <UserPlus size={13} /> Add Member
          </Button>
        )}
      </div>

      {/* Add member panel */}
      {addOpen && (
        <Card style={{ marginBottom: 16, position: 'relative' }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--t-text-secondary)',
              marginBottom: 12,
            }}
          >
            Add Member
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {/* User search */}
            <div style={{ flex: 1, position: 'relative' }}>
              <Input
                value={
                  selectedUser
                    ? `${selectedUser.email}${selectedUser.name ? ` (${selectedUser.name})` : ''}`
                    : searchQ
                }
                onChange={(v) => handleSearch(v)}
                placeholder="Search by email or name…"
              />
              {searchResults.length > 0 && !selectedUser && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--t-bg-panel)',
                    border: '1px solid var(--t-border-default)',
                    borderRadius: 6,
                    zIndex: 10,
                    overflow: 'hidden',
                    marginTop: 4,
                  }}
                >
                  {searchResults
                    .filter((u) => !existingUserIds.has(u.id))
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(u)
                          setSearchResults([])
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--t-text-secondary)',
                          fontSize: 13,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = 'var(--t-bg-elevated)')
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        {u.email}
                        {u.name ? ` — ${u.name}` : ''}
                      </button>
                    ))}
                  {searchResults.every((u) => existingUserIds.has(u.id)) && (
                    <p style={{ padding: '8px 12px', color: 'var(--t-text-muted)', fontSize: 12 }}>
                      All matching users are already members
                    </p>
                  )}
                </div>
              )}
            </div>
            {/* Role */}
            <Select
              value={addRole}
              onChange={(v) => setAddRole(v as MemberRole)}
              style={{ width: 110 }}
            >
              <option value="viewer">Viewer</option>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
            <Button
              size="sm"
              disabled={adding || !selectedUser}
              onClick={() => void handleAdd()}
              style={{ gap: 5, whiteSpace: 'nowrap' }}
            >
              <Check size={12} /> {adding ? 'Adding…' : 'Add'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAddOpen(false)
                setSearchQ('')
                setSearchResults([])
                setSelectedUser(null)
                setAddError(null)
              }}
            >
              Cancel
            </Button>
          </div>
          {addError && (
            <p style={{ fontSize: 12, color: 'var(--t-accent-danger)', marginTop: 8 }}>
              {addError}
            </p>
          )}
        </Card>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 0',
            color: 'var(--t-text-muted)',
            fontSize: 13,
          }}
        >
          No members yet. Add someone to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {members.map((m) => {
            const isMe = m.userId === authUser?.id
            const isUpdating = updatingId === m.userId
            const isRemoving = removingId === m.userId
            return (
              <Card
                key={m.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Users size={14} color="var(--t-text-muted)" />
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--t-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.name ?? m.email}
                    </span>
                    {isMe && (
                      <span style={{ fontSize: 10, color: 'var(--t-text-muted)', flexShrink: 0 }}>
                        you
                      </span>
                    )}
                    {m.role === 'admin' && (
                      <Crown
                        size={11}
                        color="var(--t-text-primary)"
                        weight="fill"
                        style={{ flexShrink: 0 }}
                      />
                    )}
                  </div>
                  {m.name && (
                    <p style={{ fontSize: 11, color: 'var(--t-text-muted)', margin: 0 }}>
                      {m.email}
                    </p>
                  )}
                </div>
                {/* Role selector (admin only) */}
                {canManage && !isMe ? (
                  <select
                    value={m.role}
                    disabled={isUpdating || isRemoving}
                    onChange={(e) => void handleRoleChange(m.userId, e.target.value as MemberRole)}
                    style={{
                      background: 'var(--t-bg-panel)',
                      border: '1px solid var(--t-border-default)',
                      borderRadius: 6,
                      color: ROLE_COLORS[m.role],
                      fontSize: 12,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <RoleBadge role={m.role} />
                )}
                {/* Remove */}
                {canManage && !isMe && (
                  <IconBtn
                    icon={<Trash size={13} />}
                    onClick={() => void handleRemove(m.userId)}
                    danger
                    title="Remove member"
                  />
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Group Access section */}
      <GroupAccessSection appId={appId} canManage={canManage} />
    </div>
  )
}

// ─── Tab: Integrations ────────────────────────────────────────────────────────

type IntType = 'jira' | 'github' | 'slack'

const INT_META: Record<
  IntType,
  {
    label: string
    icon: React.ReactNode
    fields: { key: string; label: string; placeholder: string; secret?: boolean }[]
  }
> = {
  jira: {
    label: 'Jira',
    icon: <Globe size={18} color="#0052CC" />,
    fields: [
      { key: 'host', label: 'Host', placeholder: 'https://yourorg.atlassian.net' },
      { key: 'projectKey', label: 'Project key', placeholder: 'PROJ' },
      { key: 'email', label: 'Email', placeholder: 'you@example.com' },
      { key: 'token', label: 'API token', placeholder: '••••••••', secret: true },
    ],
  },
  github: {
    label: 'GitHub',
    icon: <GithubLogo size={18} color="#ccc" />,
    fields: [
      { key: 'owner', label: 'Owner', placeholder: 'your-org' },
      { key: 'repo', label: 'Repo', placeholder: 'your-repo' },
      { key: 'token', label: 'Personal access token', placeholder: 'ghp_••••••', secret: true },
    ],
  },
  slack: {
    label: 'Slack',
    icon: <SlackLogo size={18} color="#4A154B" />,
    fields: [
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://hooks.slack.com/services/…',
        secret: true,
      },
      { key: 'channel', label: 'Channel', placeholder: '#test-alerts' },
    ],
  },
}

function IntegrationCard({
  appId,
  type,
  existing,
  onRefresh,
}: {
  appId: number
  type: IntType
  existing: AppIntegration | undefined
  onRefresh: () => void
}) {
  const meta = INT_META[type]
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(existing?.enabled ?? true)

  useEffect(() => {
    if (existing) {
      setForm(existing.config as Record<string, string>)
      setEnabled(existing.enabled)
    }
  }, [existing])

  const save = async () => {
    setSaving(true)
    await api.integrations.upsert(appId, type, form, enabled)
    await onRefresh()
    setExpanded(false)
    setSaving(false)
  }

  const remove = async () => {
    await api.integrations.delete(appId, type)
    setForm({})
    await onRefresh()
  }

  const isConnected = !!existing

  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'var(--t-bg-panel)',
            border: '1px solid var(--t-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {meta.icon}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)' }}>
            {meta.label}
          </p>
          <p
            style={{
              fontSize: 12,
              color: isConnected ? 'var(--t-accent-success)' : 'var(--t-text-muted)',
            }}
          >
            {isConnected
              ? enabled
                ? 'Connected & enabled'
                : 'Connected but disabled'
              : 'Not connected'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {isConnected && (
            <IconBtn icon={<Trash size={13} />} onClick={remove} danger title="Disconnect" />
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpanded((e) => !e)}
            style={{ gap: 5 }}
          >
            <PencilSimple size={12} /> {isConnected ? 'Edit' : 'Connect'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div
          style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--t-border-subtle)' }}
        >
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}
          >
            {meta.fields.map((f) => (
              <div key={f.key}>
                <p style={{ fontSize: 11, color: 'var(--t-text-secondary)', marginBottom: 5 }}>
                  {f.label}
                </p>
                <Input
                  value={form[f.key] ?? ''}
                  onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <input
              type="checkbox"
              id={`${type}-enabled`}
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ width: 14, height: 14, cursor: 'pointer' }}
            />
            <label
              htmlFor={`${type}-enabled`}
              style={{ fontSize: 13, color: 'var(--t-text-secondary)', cursor: 'pointer' }}
            >
              Enabled
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={save} disabled={saving} style={{ gap: 5 }}>
              <Check size={12} /> {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExpanded(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function IntegrationsTab({ appId }: { appId: number }) {
  const [integrations, setIntegrations] = useState<AppIntegration[]>([])

  const load = useCallback(async () => {
    const data = await api.integrations.list(appId).catch(() => [])
    setIntegrations(data)
  }, [appId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <SectionHeader>Integrations</SectionHeader>
      <p style={{ fontSize: 13, color: 'var(--t-text-secondary)', marginBottom: 20 }}>
        Connect this app to external tools for notifications and issue linking.
      </p>
      {(['jira', 'github', 'slack'] as IntType[]).map((type) => (
        <IntegrationCard
          key={type}
          appId={appId}
          type={type}
          existing={integrations.find((i) => i.type === type)}
          onRefresh={load}
        />
      ))}
    </div>
  )
}

// ─── Main SettingsView ────────────────────────────────────────────────────────

const TESTS_TABS = [
  { id: 'fields', label: 'Custom Fields', icon: <SlidersHorizontal size={14} /> },
  { id: 'defaults', label: 'Defaults', icon: <Check size={14} /> },
  { id: 'tags', label: 'Tags', icon: <Tag size={14} /> },
  { id: 'labels', label: 'Labels', icon: <Palette size={14} /> },
  { id: 'integrations', label: 'Integrations', icon: <PlugsConnected size={14} /> },
] as const

type TestsTabId = (typeof TESTS_TABS)[number]['id']

interface Props {
  appId: number
  appName: string
  section?: 'tests' | 'members'
}

export function SettingsView({ appId, appName, section = 'tests' }: Props) {
  const [tab, setTab] = useState<TestsTabId>('fields')

  // ── Members section ──────────────────────────────────────────────────────────
  if (section === 'members') {
    // Determine canManage once we know membership; pass isSuperAdmin as a safe default
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
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 28px',
            height: 52,
            borderBottom: '1px solid var(--t-border-subtle)',
            flexShrink: 0,
          }}
        >
          <Users size={15} color="var(--t-text-muted)" />
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)' }}>
            Members
          </span>
          <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>·</span>
          <span style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{appName}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          <MembersTab appId={appId} />
        </div>
      </div>
    )
  }

  // ── Tests settings section ───────────────────────────────────────────────────
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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 28px',
          height: 52,
          borderBottom: '1px solid var(--t-border-subtle)',
          flexShrink: 0,
        }}
      >
        <SlidersHorizontal size={15} color="var(--t-text-muted)" />
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)' }}>Tests</span>
        <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>·</span>
        <span style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{appName}</span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Left nav */}
        <div
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: '1px solid var(--t-border-subtle)',
            padding: '16px 0',
            overflowY: 'auto',
          }}
        >
          {TESTS_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 20px',
                border: 'none',
                cursor: 'pointer',
                background: tab === t.id ? 'var(--t-bg-panel)' : 'transparent',
                color: tab === t.id ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
                fontSize: 13,
                textAlign: 'left',
                transition: 'all 0.1s',
                borderLeft:
                  tab === t.id ? '2px solid var(--t-border-strong)' : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (tab !== t.id)
                  (e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
              }}
              onMouseLeave={(e) => {
                if (tab !== t.id)
                  (e.currentTarget as HTMLElement).style.color = 'var(--t-text-muted)'
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {tab === 'fields' && <CustomFieldsTab appId={appId} />}
          {tab === 'defaults' && <DefaultsTab appId={appId} />}
          {tab === 'tags' && <TagsTab appId={appId} />}
          {tab === 'labels' && <LabelsTab appId={appId} />}
          {tab === 'integrations' && <IntegrationsTab appId={appId} />}
        </div>
      </div>
    </div>
  )
}
