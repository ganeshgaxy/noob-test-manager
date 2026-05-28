import { useState, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DotsThreeVertical } from '@phosphor-icons/react'

export interface RowMenuItem {
  label: string
  icon: ReactNode
  action: () => void
  destructive?: boolean
  separator?: boolean // renders a divider ABOVE this item
}

interface RowMenuProps {
  items: RowMenuItem[]
  /** Size of the ⋮ trigger button (default 28) */
  size?: number
  /** When true the trigger is always opaque (parent controls visibility) */
  alwaysVisible?: boolean
}

export function RowMenu({ items, size = 28, alwaysVisible = false }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.right - 168 })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="row-action-btn"
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          background: open ? 'var(--t-bg-surface)' : 'transparent',
          color: open ? 'var(--t-text-secondary)' : 'var(--t-text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          opacity: open || alwaysVisible ? 1 : 0,
          transition: 'opacity 0.1s, background 0.1s',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.background = 'var(--t-bg-surface)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
        }}
        onMouseLeave={(e) => {
          if (!open) {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-muted)'
          }
        }}
        title="More actions"
      >
        <DotsThreeVertical size={14} weight="bold" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: pos.top,
              left: Math.max(pos.left, 8),
              width: 168,
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 9999,
              overflow: 'hidden',
              padding: '4px 0',
            }}
          >
            {items.map((item, i) => (
              <div key={i}>
                {item.separator && (
                  <div
                    style={{ height: 1, background: 'var(--t-border-subtle)', margin: '4px 0' }}
                  />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
                    item.action()
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: item.destructive ? 'var(--t-accent-danger)' : 'var(--t-text-secondary)',
                    fontSize: 13,
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = item.destructive
                      ? 'rgba(229,72,77,0.08)'
                      : 'var(--t-bg-surface)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <span style={{ flexShrink: 0, opacity: 0.7 }}>{item.icon}</span>
                  {item.label}
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
