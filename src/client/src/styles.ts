export const c = {
  bg: '#0a0a0a',
  surface: '#141414',
  surface2: '#1e1e1e',
  surface3: '#282828',
  border: '#2a2a2a',
  border2: '#3a3a3a',
  text: '#f0f0f0',
  muted: '#8a8a8a',
  subtle: '#4a4a4a',
  blue: '#0070f3',
  blueDim: '#071e40',
  green: '#22c55e',
  greenDim: '#052e16',
  red: '#ef4444',
  redDim: '#2d0a0a',
  yellow: '#eab308',
  purple: '#a855f7',
  orange: '#f97316',
}

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
}

export const font = {
  xs: { fontSize: 11 },
  sm: { fontSize: 12 },
  base: { fontSize: 13 },
  md: { fontSize: 14 },
  lg: { fontSize: 16 },
  xl: { fontSize: 20 },
  h1: { fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em' },
}

// Reusable component styles
export const s = {
  input: {
    width: '100%',
    background: 'var(--t-bg-elevated)',
    border: '1px solid var(--t-border-default)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--t-text-primary)',
    outline: 'none',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,

  textarea: {
    width: '100%',
    background: 'var(--t-bg-elevated)',
    border: '1px solid var(--t-border-default)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--t-text-primary)',
    outline: 'none',
    resize: 'vertical' as const,
    transition: 'border-color 0.15s',
  } as React.CSSProperties,

  select: {
    width: '100%',
    background: 'var(--t-bg-elevated)',
    border: '1px solid var(--t-border-default)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--t-text-primary)',
    outline: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--t-text-primary)',
    color: 'var(--t-bg-base)',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s',
  } as React.CSSProperties,

  btnGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--t-bg-elevated)',
    color: 'var(--t-text-secondary)',
    border: '1px solid var(--t-border-default)',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties,

  label: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--t-text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    display: 'block',
    marginBottom: 6,
  } as React.CSSProperties,

  card: {
    background: 'var(--t-bg-panel)',
    border: '1px solid var(--t-border-default)',
    borderRadius: 12,
    overflow: 'hidden',
  } as React.CSSProperties,
}
