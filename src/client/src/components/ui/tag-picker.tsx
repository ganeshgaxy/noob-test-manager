import { useState, useRef, useEffect } from 'react'
import { Tag, Plus, X, Globe, Buildings } from '@phosphor-icons/react'
import type { GlobalTag, SpaceTag } from '../../types/index.js'

// ─── Tag pill colours ─────────────────────────────────────────────────────────

const _PRESET_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#06b6d4', // cyan
]

function tagBg(color: string | null | undefined) {
  return color ? `${color}22` : 'rgba(255,255,255,0.06)'
}
function tagFg(color: string | null | undefined) {
  return color ?? 'var(--t-text-secondary)'
}
function tagBorder(color: string | null | undefined) {
  return color ? `${color}55` : 'var(--t-border-subtle)'
}

// ─── Pill component ───────────────────────────────────────────────────────────

export function TagPill({
  name,
  color,
  onRemove,
  size = 'md',
}: {
  name: string
  color?: string | null
  onRemove?: () => void
  size?: 'sm' | 'md'
}) {
  const fontSize = size === 'sm' ? 10 : 11
  const padding = size === 'sm' ? '2px 6px' : '3px 8px'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding,
        borderRadius: 20,
        fontSize,
        fontWeight: 600,
        background: tagBg(color),
        color: tagFg(color),
        border: `1px solid ${tagBorder(color)}`,
        whiteSpace: 'nowrap',
      }}
    >
      {name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            color: 'inherit',
            opacity: 0.7,
          }}
          title={`Remove ${name}`}
        >
          <X size={9} weight="bold" />
        </button>
      )}
    </span>
  )
}

// ─── TagPicker ────────────────────────────────────────────────────────────────

export interface TagPickerProps {
  /** Currently selected tag names */
  selected: string[]
  onChange: (names: string[]) => void
  globalTags: GlobalTag[]
  spaceTags: SpaceTag[]
  /** Called when user creates a brand-new tag name (should persist to space-tags) */
  onCreateSpaceTag: (name: string) => Promise<SpaceTag | null>
  disabled?: boolean
}

export function TagPicker({
  selected,
  onChange,
  globalTags,
  spaceTags,
  onCreateSpaceTag,
  disabled = false,
}: TagPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const allGlobalNames = new Set(globalTags.map((t) => t.name.toLowerCase()))

  // Filtered lists
  const q = query.trim().toLowerCase()
  const filteredGlobal = globalTags.filter(
    (t) => !selected.includes(t.name) && (q === '' || t.name.toLowerCase().includes(q))
  )
  const filteredSpace = spaceTags.filter(
    (t) => !selected.includes(t.name) && (q === '' || t.name.toLowerCase().includes(q))
  )

  const canCreate =
    q !== '' &&
    !allGlobalNames.has(q) &&
    !spaceTags.find((t) => t.name.toLowerCase() === q) &&
    !globalTags.find((t) => t.name.toLowerCase() === q) &&
    !selected.find((s) => s.toLowerCase() === q)

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((s) => s !== name))
    } else {
      onChange([...selected, name])
      setQuery('')
    }
  }

  function remove(name: string) {
    onChange(selected.filter((s) => s !== name))
  }

  async function handleCreate() {
    if (!canCreate || creating) return
    setCreating(true)
    const tag = await onCreateSpaceTag(query.trim())
    if (tag) {
      onChange([...selected, tag.name])
    }
    setQuery('')
    setCreating(false)
  }

  const hasResults = filteredGlobal.length > 0 || filteredSpace.length > 0 || canCreate

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Pills + input trigger */}
      <div
        onClick={() => {
          if (!disabled) {
            setOpen(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
        style={{
          minHeight: 36,
          border: '1px solid var(--t-border-default)',
          borderRadius: 8,
          padding: '4px 8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          alignItems: 'center',
          background: 'var(--t-bg-input, var(--t-bg-panel))',
          cursor: disabled ? 'default' : 'text',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {selected.map((name) => {
          const gt = globalTags.find((t) => t.name === name)
          const st = spaceTags.find((t) => t.name === name)
          const color = gt?.color ?? st?.color ?? null
          return (
            <TagPill
              key={name}
              name={name}
              color={color}
              onRemove={disabled ? undefined : () => remove(name)}
            />
          )
        })}
        {!disabled && (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (canCreate) handleCreate()
              }
              if (e.key === 'Escape') {
                setOpen(false)
                setQuery('')
              }
              if (e.key === 'Backspace' && query === '' && selected.length > 0) {
                remove(selected[selected.length - 1])
              }
            }}
            placeholder={selected.length === 0 ? 'Search or create tags…' : ''}
            style={{
              flex: 1,
              minWidth: 120,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              color: 'var(--t-text-primary)',
            }}
          />
        )}
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 200,
            background: 'var(--t-bg-surface)',
            border: '1px solid var(--t-border-default)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {!hasResults && (
            <div
              style={{
                padding: '12px 14px',
                fontSize: 12,
                color: 'var(--t-text-muted)',
                textAlign: 'center',
              }}
            >
              No tags found
            </div>
          )}

          {/* Create new */}
          {canCreate && (
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{
                width: '100%',
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--t-border-subtle)',
                cursor: creating ? 'wait' : 'pointer',
                color: 'var(--t-text-primary)',
                fontSize: 13,
                textAlign: 'left',
              }}
            >
              <Plus size={14} style={{ color: 'var(--t-text-secondary)', flexShrink: 0 }} />
              <span>
                Create space tag{' '}
                <strong style={{ color: 'var(--t-text-secondary)' }}>
                  &ldquo;{query.trim()}&rdquo;
                </strong>
              </span>
            </button>
          )}

          {/* Global tags section */}
          {filteredGlobal.length > 0 && (
            <>
              <div
                style={{
                  padding: '6px 14px 3px',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--t-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Globe size={11} />
                Global
              </div>
              {filteredGlobal.map((t) => (
                <TagOption key={`g-${t.id}`} tag={t} onSelect={() => toggle(t.name)} />
              ))}
            </>
          )}

          {/* Space tags section */}
          {filteredSpace.length > 0 && (
            <>
              <div
                style={{
                  padding: '6px 14px 3px',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--t-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  borderTop:
                    filteredGlobal.length > 0 ? '1px solid var(--t-border-subtle)' : undefined,
                  marginTop: filteredGlobal.length > 0 ? 4 : 0,
                }}
              >
                <Buildings size={11} />
                Space
              </div>
              {filteredSpace.map((t) => (
                <TagOption key={`s-${t.id}`} tag={t} onSelect={() => toggle(t.name)} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TagOption({
  tag,
  onSelect,
}: {
  tag: { id: number; name: string; color: string | null }
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%',
        padding: '7px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--t-text-primary)',
        fontSize: 13,
        textAlign: 'left',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)')
      }
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: tag.color ?? 'var(--t-text-muted)',
          flexShrink: 0,
        }}
      />
      <Tag size={12} style={{ color: 'var(--t-text-muted)', flexShrink: 0 }} />
      {tag.name}
    </button>
  )
}
