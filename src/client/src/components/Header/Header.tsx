import { BugBeetle } from '@phosphor-icons/react'

export function Header() {
  return (
    <header
      style={{
        height: 48,
        background: 'var(--t-bg-base)',
        borderBottom: '1px solid var(--t-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 10,
        flexShrink: 0,
      }}
    >
      <BugBeetle size={18} weight="fill" color="var(--t-text-primary)" />
      <span
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--t-text-primary)',
          letterSpacing: '-0.02em',
        }}
      >
        noob-sdet
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--t-text-secondary)',
          background: 'var(--t-bg-elevated)',
          border: '1px solid var(--t-border-default)',
          borderRadius: 6,
          padding: '2px 8px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Test Manager
      </span>
    </header>
  )
}
