import { useBranding } from '../../contexts/BrandingContext.js'

export function Header() {
  const { branding } = useBranding()

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
      {branding.iconData ? (
        <img
          src={branding.iconData}
          alt={branding.appTitle}
          style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            background: 'var(--t-bg-elevated)',
            border: '1px solid var(--t-border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--t-text-secondary)',
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}
        >
          {branding.appTitle.charAt(0).toUpperCase()}
        </div>
      )}
      <span
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--t-text-primary)',
          letterSpacing: '-0.02em',
        }}
      >
        {branding.appTitle}
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
