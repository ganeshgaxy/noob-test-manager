import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppTheme } from '../types/index.js'
import { api } from '../lib/api.js'

// ─── Built-in presets ─────────────────────────────────────────────────────────

export const THEME_PRESETS: AppTheme[] = [
  {
    name: 'Dark',
    bgBase: '#000000',
    bgSurface: '#0d0d0d',
    bgPanel: '#111111',
    bgElevated: '#141414',
    bgHover: '#161616',
    borderSubtle: '#1a1a1a',
    borderDefault: '#222222',
    borderStrong: '#333333',
    textPrimary: '#ededed',
    textSecondary: '#888888',
    textMuted: '#555555',
    accentDanger: '#e5484d',
    accentSuccess: '#1a9e5e',
    accentWarning: '#b45309',
    accentBlocked: '#f97316',
    fontSans: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, "Cascadia Code", monospace',
    radius: 8,
  },
  {
    name: 'Dim',
    bgBase: '#0a0a0f',
    bgSurface: '#12121a',
    bgPanel: '#18181f',
    bgElevated: '#1e1e28',
    bgHover: '#202030',
    borderSubtle: '#22222e',
    borderDefault: '#2a2a38',
    borderStrong: '#38384a',
    textPrimary: '#e2e2f0',
    textSecondary: '#8888aa',
    textMuted: '#55556a',
    accentDanger: '#e5484d',
    accentSuccess: '#1a9e5e',
    accentWarning: '#b45309',
    accentBlocked: '#f97316',
    fontSans: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, "Cascadia Code", monospace',
    radius: 8,
  },
  {
    name: 'Light',
    bgBase: '#f6f6f7',
    bgSurface: '#ffffff',
    bgPanel: '#f9f9fa',
    bgElevated: '#ffffff',
    bgHover: '#f0f0f1',
    borderSubtle: '#ebebec',
    borderDefault: '#e2e2e4',
    borderStrong: '#c4c4c8',
    textPrimary: '#111113',
    textSecondary: '#696970',
    textMuted: '#a8a8b3',
    accentDanger: '#dc2626',
    accentSuccess: '#16a34a',
    accentWarning: '#d97706',
    accentBlocked: '#ea580c',
    fontSans: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, "Cascadia Code", monospace',
    radius: 8,
  },
  {
    name: 'Midnight',
    bgBase: '#030712',
    bgSurface: '#0f172a',
    bgPanel: '#1e293b',
    bgElevated: '#1e293b',
    bgHover: '#1a2540',
    borderSubtle: '#1e293b',
    borderDefault: '#334155',
    borderStrong: '#475569',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#475569',
    accentDanger: '#ef4444',
    accentSuccess: '#22c55e',
    accentWarning: '#f59e0b',
    accentBlocked: '#f97316',
    fontSans: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, "Cascadia Code", monospace',
    radius: 6,
  },
]

// ─── Apply to :root ───────────────────────────────────────────────────────────

function applyTheme(t: AppTheme) {
  const root = document.documentElement
  root.style.setProperty('--t-bg-base', t.bgBase)
  root.style.setProperty('--t-bg-surface', t.bgSurface)
  root.style.setProperty('--t-bg-panel', t.bgPanel)
  root.style.setProperty('--t-bg-elevated', t.bgElevated)
  root.style.setProperty('--t-bg-hover', t.bgHover ?? '#161616')
  // Sidebar row overlays — auto-detect light vs dark from bgBase
  const isLight = parseInt(t.bgBase.slice(1, 3), 16) > 128
  root.style.setProperty(
    '--t-sidebar-hover',
    isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)'
  )
  root.style.setProperty(
    '--t-sidebar-active',
    isLight ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.09)'
  )
  // Row-level hover/selected overlays — theme-aware
  root.style.setProperty('--t-row-hover', isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.025)')
  root.style.setProperty(
    '--t-row-selected',
    isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'
  )
  root.style.setProperty('--t-elem-hover', isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)')
  // Shadows
  root.style.setProperty(
    '--t-shadow-sm',
    isLight
      ? '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)'
      : '0 4px 16px rgba(0,0,0,0.5)'
  )
  root.style.setProperty(
    '--t-shadow-lg',
    isLight
      ? '0 8px 28px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)'
      : '0 24px 60px rgba(0,0,0,0.8)'
  )
  // Overlay backdrop
  root.style.setProperty('--t-overlay', isLight ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.6)')
  // Status accent colours
  root.style.setProperty('--t-accent-blocked', t.accentBlocked)
  root.style.setProperty('--t-border-subtle', t.borderSubtle)
  root.style.setProperty('--t-border-default', t.borderDefault)
  root.style.setProperty('--t-border-strong', t.borderStrong)
  root.style.setProperty('--t-text-primary', t.textPrimary)
  root.style.setProperty('--t-text-secondary', t.textSecondary)
  root.style.setProperty('--t-text-muted', t.textMuted)
  root.style.setProperty('--t-accent-danger', t.accentDanger)
  root.style.setProperty('--t-accent-success', t.accentSuccess)
  root.style.setProperty('--t-accent-warning', t.accentWarning)
  root.style.setProperty('--t-font-sans', t.fontSans)
  root.style.setProperty('--t-font-mono', t.fontMono)
  root.style.setProperty('--t-radius', `${t.radius}px`)
  // Mirror into tailwind/radix tokens
  root.style.setProperty('--background', t.bgBase)
  root.style.setProperty('--foreground', t.textPrimary)
  root.style.setProperty('--border', t.borderStrong)
  root.style.setProperty('--muted', t.bgPanel)
  root.style.setProperty('--muted-foreground', t.textSecondary)
  root.style.setProperty('--destructive', t.accentDanger)
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: AppTheme
  setTheme: (t: AppTheme, persist?: boolean) => Promise<void>
  resetTheme: () => Promise<void>
  loading: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(THEME_PRESETS[0])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.theme
      .get()
      .then((savedTheme) => {
        // Merge with matching preset so any new fields (e.g. bgHover) are
        // always populated even when the DB row was written before they existed.
        const preset = THEME_PRESETS.find((p) => p.name === savedTheme.name) ?? THEME_PRESETS[0]
        const merged: AppTheme = { ...preset }
        for (const [k, v] of Object.entries(savedTheme)) {
          if (v !== undefined && v !== null) (merged as Record<string, unknown>)[k] = v
        }
        setThemeState(merged)
        applyTheme(merged)
      })
      .catch(() => applyTheme(THEME_PRESETS[0]))
      .finally(() => setLoading(false))
  }, [])

  const setTheme = async (t: AppTheme, persist = true) => {
    setThemeState(t)
    applyTheme(t)
    if (persist) await api.theme.update(t)
  }

  const resetTheme = async () => {
    const t = await api.theme.reset()
    setThemeState(t)
    applyTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resetTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
