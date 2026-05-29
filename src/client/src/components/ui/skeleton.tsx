// ─── Skeleton primitives ──────────────────────────────────────────────────────
// Usage: <Skeleton /> — fills container width by default
//        <Skeleton width={80} height={10} borderRadius={99} /> — pill
//        <SkeletonRows count={4} rowHeight={44} gap={1} />   — list placeholder

import React from 'react'

// Inject the keyframe once into the document head
const STYLE_ID = '__skeleton_shimmer__'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes _sk_shimmer {
      from { transform: translateX(-100%); }
      to   { transform: translateX(200%); }
    }
  `
  document.head.appendChild(style)
}

export function Skeleton({
  width,
  height = 14,
  borderRadius = 4,
  style,
}: {
  width?: number | string
  height?: number | string
  borderRadius?: number | string
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        width: width ?? '100%',
        height,
        borderRadius,
        background: 'var(--t-border-default)',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, transparent 0%, var(--t-bg-hover) 50%, transparent 100%)',
          animation: '_sk_shimmer 1.5s ease-in-out infinite',
        }}
      />
    </div>
  )
}

// ─── A single "icon + two text lines" list row skeleton ───────────────────────

export function SkeletonListRow({
  iconSize = 32,
  gap = 10,
  height = 44,
  style,
}: {
  iconSize?: number
  gap?: number
  height?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap,
        padding: '0 16px',
        height,
        flexShrink: 0,
        ...style,
      }}
    >
      <Skeleton width={iconSize} height={iconSize} borderRadius={8} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton height={11} width="55%" borderRadius={3} />
        <Skeleton height={9} width="35%" borderRadius={3} />
      </div>
    </div>
  )
}

// ─── Stacked rows (table / list body placeholder) ─────────────────────────────

export function SkeletonRows({
  count = 5,
  rowHeight = 44,
  gap = 1,
  padding = '0 16px',
  showIcon = true,
  iconSize = 28,
}: {
  count?: number
  rowHeight?: number
  gap?: number
  padding?: string
  showIcon?: boolean
  iconSize?: number
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding,
            height: rowHeight,
            borderBottom: `${gap}px solid var(--t-border-subtle)`,
            flexShrink: 0,
          }}
        >
          {showIcon && <Skeleton width={iconSize} height={iconSize} borderRadius={6} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Skeleton height={11} width={`${50 + ((i * 17) % 35)}%`} borderRadius={3} />
            <Skeleton height={9} width={`${25 + ((i * 11) % 25)}%`} borderRadius={3} />
          </div>
          <Skeleton width={48} height={22} borderRadius={4} />
        </div>
      ))}
    </>
  )
}

// ─── Sidebar item skeleton (compact, no sub-text) ─────────────────────────────

export function SkeletonSidebarItem({ i = 0 }: { i?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 30,
        flexShrink: 0,
      }}
    >
      <Skeleton width={14} height={14} borderRadius={3} />
      <Skeleton height={11} width={`${45 + ((i * 19) % 40)}%`} borderRadius={3} />
    </div>
  )
}

// ─── Card / panel block skeleton (e.g. settings sections) ─────────────────────

export function SkeletonBlock({
  lines = 3,
  style,
}: {
  lines?: number
  style?: React.CSSProperties
}) {
  const widths = ['80%', '60%', '70%', '50%', '65%']
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '16px',
        border: '1px solid var(--t-border-subtle)',
        borderRadius: 8,
        background: 'var(--t-bg-surface)',
        ...style,
      }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={widths[i % widths.length]} borderRadius={3} />
      ))}
    </div>
  )
}
