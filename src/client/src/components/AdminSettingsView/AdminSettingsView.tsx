import { useState, useEffect, useCallback } from 'react'
import {
  Database,
  Lightning,
  GearSix,
  CheckCircle,
  Warning,
  ShieldCheck,
  X,
  Palette,
  ArrowCounterClockwise,
  Tag,
  Trash,
  Plus,
  HardDrives,
  PaintBrush,
} from '@phosphor-icons/react'
import { Input } from '@/components/ui/input.js'
import { Label } from '@/components/ui/label.js'
import { Button } from '@/components/ui/button.js'
import { AuthConfigDialog } from '../AuthConfigDialog/AuthConfigDialog.js'
import { SsoConfigDialog } from '../AuthConfigDialog/SsoConfigDialog.js'
import { useAuth } from '../../contexts/AuthContext.js'
import { useTheme, THEME_PRESETS } from '../../contexts/ThemeContext.js'
import { api } from '../../lib/api.js'
import type { AppTheme, GlobalTag } from '../../types/index.js'
import { TagPill } from '../ui/tag-picker.js'
import { useBranding } from '../../contexts/BrandingContext.js'
import { SkeletonSidebarItem, SkeletonRows } from '../ui/skeleton.js'
import { getAppsCacheSize, clearAppsCache } from '../../features/apps/hooks.js'
import { getSpacesCacheSize, clearAllSpacesCache } from '../../features/spaces/hooks.js'
import { getFoldersCacheSize, clearAllFoldersCache } from '../../features/folders/hooks.js'
import {
  getTestsCacheSize,
  getTestDetailCacheSize,
  clearAllTestsCache,
  clearAllTestDetailsCache,
} from '../../features/tests/hooks.js'
import {
  getRunsCacheSize,
  clearAllRunsCache,
  getRunResultsCacheSize,
  clearAllRunResultsCache,
} from '../../features/runs/hooks.js'

// ─── Setting card ─────────────────────────────────────────────────────────────

function SettingCard({
  icon,
  title,
  description,
  badge,
  onConfigure,
}: {
  icon: React.ReactNode
  title: string
  description: string
  badge?: string
  onConfigure: () => void
}) {
  return (
    <div
      style={{
        background: 'var(--t-bg-surface)',
        border: '1px solid var(--t-border-subtle)',
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 280,
        maxWidth: 340,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--t-border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--t-text-secondary)',
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--t-text-primary)',
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>
          <div
            style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 3, lineHeight: 1.4 }}
          >
            {description}
          </div>
        </div>
      </div>
      {badge && (
        <div
          style={{
            display: 'inline-flex',
            alignSelf: 'flex-start',
            padding: '3px 10px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--t-border-default)',
            fontSize: 11,
            color: 'var(--t-text-muted)',
            fontFamily: 'monospace',
          }}
        >
          {badge}
        </div>
      )}
      <Button variant="outline" style={{ alignSelf: 'flex-start' }} onClick={onConfigure}>
        Configure
      </Button>
    </div>
  )
}

// ─── AdminSettingsView ────────────────────────────────────────────────────────

export function AdminSettingsView() {
  const { user } = useAuth()
  const isSuperAdmin = user?.globalRole === 'super_admin'
  const { theme, setTheme, resetTheme } = useTheme()

  // ── Theme editor state ──────────────────────────────────────────────────────
  const [themeDialogOpen, setThemeDialogOpen] = useState(false)
  const [draftTheme, setDraftTheme] = useState<AppTheme>({ ...theme })
  const [themeSaving, setThemeSaving] = useState(false)

  // Sync draft whenever the global theme changes (e.g. on mount)
  useEffect(() => {
    setDraftTheme({ ...theme })
  }, [theme])

  const applyDraft = useCallback(
    (patch: Partial<AppTheme>) => {
      const next = { ...draftTheme, ...patch }
      setDraftTheme(next)
      // Live preview — update without persisting
      setTheme(next, false)
    },
    [draftTheme, setTheme]
  )

  const saveTheme = async () => {
    setThemeSaving(true)
    try {
      await setTheme(draftTheme, true)
      setThemeDialogOpen(false)
    } finally {
      setThemeSaving(false)
    }
  }

  const handleResetTheme = async () => {
    await resetTheme()
    setThemeDialogOpen(false)
  }

  // ── DB state ────────────────────────────────────────────────────────────────
  const [dbDialogOpen, setDbDialogOpen] = useState(false)
  const [dbType, setDbType] = useState<'sqlite' | 'turso' | 'postgres'>('sqlite')
  const [dbUrl, setDbUrl] = useState('')
  const [dbToken, setDbToken] = useState('')
  const [dbPoolMax, setDbPoolMax] = useState('10')
  const [dbStatus, setDbStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [dbLoading, setDbLoading] = useState(false)
  const [currentDbType, setCurrentDbType] = useState<string>('sqlite')

  // ── Cache state ─────────────────────────────────────────────────────────────
  const [cacheDialogOpen, setCacheDialogOpen] = useState(false)
  const [cacheType, setCacheType] = useState<'none' | 'lru' | 'redis'>('none')
  const [currentCacheType, setCurrentCacheType] = useState<string>('none')
  const [cacheLruMax, setCacheLruMax] = useState('500')
  const [cacheRedisUrl, setCacheRedisUrl] = useState('')
  const [cacheTtl, setCacheTtl] = useState('30')
  const [cacheStatus, setCacheStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [cacheLoading, setCacheLoading] = useState(false)

  // ── Auth config state ───────────────────────────────────────────────────────
  const [authConfigOpen, setAuthConfigOpen] = useState(false)
  const [currentAuthMode, setCurrentAuthMode] = useState<string>('admin')

  // ── SSO config state ────────────────────────────────────────────────────────
  const [ssoConfigOpen, setSsoConfigOpen] = useState(false)
  const [currentSsoProvider, setCurrentSsoProvider] = useState<string>('none')

  // ── Client cache state ──────────────────────────────────────────────────────
  const [clientCacheOpen, setClientCacheOpen] = useState(false)

  type CacheEntry = { label: string; description: string; size: number; clear: () => void }
  const [cacheEntries, setCacheEntries] = useState<CacheEntry[]>([])

  const buildCacheEntries = (): CacheEntry[] => [
    {
      label: 'Apps',
      description: 'List of all applications',
      size: getAppsCacheSize(),
      clear: clearAppsCache,
    },
    {
      label: 'Spaces',
      description: 'Spaces per application',
      size: getSpacesCacheSize(),
      clear: clearAllSpacesCache,
    },
    {
      label: 'Folders',
      description: 'Folders per space',
      size: getFoldersCacheSize(),
      clear: clearAllFoldersCache,
    },
    {
      label: 'Tests',
      description: 'Test lists per folder',
      size: getTestsCacheSize(),
      clear: clearAllTestsCache,
    },
    {
      label: 'Test Details',
      description: 'Full test detail with steps',
      size: getTestDetailCacheSize(),
      clear: clearAllTestDetailsCache,
    },
    {
      label: 'Runs',
      description: 'Test runs per application',
      size: getRunsCacheSize(),
      clear: clearAllRunsCache,
    },
    {
      label: 'Run Results',
      description: 'Test results and report per run',
      size: getRunResultsCacheSize(),
      clear: clearAllRunResultsCache,
    },
  ]

  const openClientCache = () => {
    setCacheEntries(buildCacheEntries())
    setClientCacheOpen(true)
  }

  const handleClearOne = (index: number) => {
    cacheEntries[index].clear()
    setCacheEntries(buildCacheEntries())
  }

  const handleClearAll = () => {
    clearAppsCache()
    clearAllSpacesCache()
    clearAllFoldersCache()
    clearAllTestsCache()
    clearAllTestDetailsCache()
    clearAllRunsCache()
    clearAllRunResultsCache()
    setCacheEntries(buildCacheEntries())
  }

  const totalClientCacheEntries = cacheEntries.reduce((s, e) => s + e.size, 0)

  // ── Customisation state ─────────────────────────────────────────────────────
  const { branding, setBranding, resetBranding } = useBranding()
  const [customOpen, setCustomOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftIcon, setDraftIcon] = useState<string | null>(null)
  const [customSaving, setCustomSaving] = useState(false)

  const openCustom = () => {
    setDraftTitle(branding.appTitle)
    setDraftIcon(branding.iconData)
    setCustomOpen(true)
  }

  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/svg+xml', 'image/png'].includes(file.type)) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setDraftIcon(reader.result)
    }
    reader.readAsDataURL(file)
    // reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleCustomSave = async () => {
    if (!draftTitle.trim()) return
    setCustomSaving(true)
    try {
      await setBranding({ appTitle: draftTitle.trim(), iconData: draftIcon })
      setCustomOpen(false)
    } finally {
      setCustomSaving(false)
    }
  }

  const handleCustomReset = async () => {
    await resetBranding()
    setCustomOpen(false)
  }

  // ── Global tags state ───────────────────────────────────────────────────────
  const [globalTagsOpen, setGlobalTagsOpen] = useState(false)
  const [globalTagList, setGlobalTagList] = useState<GlobalTag[]>([])
  const [globalTagsLoading, setGlobalTagsLoading] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const [tagCreateError, setTagCreateError] = useState('')
  const [tagCreating, setTagCreating] = useState(false)

  // ── Load current config summaries for card badges ───────────────────────────
  useEffect(() => {
    api.dbConfig
      .get()
      .then((cfg) => {
        setCurrentDbType(cfg.type)
        setDbType(cfg.type as 'sqlite' | 'turso' | 'postgres')
        setDbUrl(cfg.type === 'sqlite' ? '' : cfg.url)
        setDbPoolMax(String((cfg as { poolMax?: number }).poolMax ?? 10))
      })
      .catch(() => {})

    api.cacheConfig
      .get()
      .then((cfg) => {
        setCurrentCacheType(cfg.active)
        setCacheType(cfg.type as 'none' | 'lru' | 'redis')
        setCacheLruMax(String(cfg.lruMax ?? 500))
        setCacheRedisUrl(cfg.redisUrl ?? '')
        setCacheTtl(String(cfg.ttl ?? 30))
      })
      .catch(() => {})

    if (isSuperAdmin) {
      api.authConfig
        .get()
        .then((cfg) => {
          setCurrentAuthMode(
            (cfg as { passwordReset?: { type?: string } }).passwordReset?.type ?? 'admin'
          )
          const sso = (cfg as { sso?: { type?: string } }).sso
          setCurrentSsoProvider(sso?.type ?? 'none')
        })
        .catch(() => {})
    }
  }, [isSuperAdmin])

  // ── DB handlers ─────────────────────────────────────────────────────────────
  const openDbDialog = async () => {
    setDbStatus(null)
    setDbLoading(true)
    try {
      const cfg = await api.dbConfig.get()
      setCurrentDbType(cfg.type)
      setDbType(cfg.type as 'sqlite' | 'turso' | 'postgres')
      setDbUrl(cfg.type === 'sqlite' ? '' : cfg.url)
      setDbToken('')
      setDbPoolMax(String((cfg as { poolMax?: number }).poolMax ?? 10))
    } catch {
      /* ignore */
    } finally {
      setDbLoading(false)
    }
    setDbDialogOpen(true)
  }

  const handleDbTest = async () => {
    setDbLoading(true)
    setDbStatus(null)
    try {
      const url = dbType === 'sqlite' ? 'file:noob-sdet.db' : dbUrl.trim()
      const res = await api.dbConfig.test({ type: dbType, url, token: dbToken.trim() || undefined })
      setDbStatus({
        ok: res.ok,
        message: res.error ?? res.message ?? (res.ok ? 'Connection successful!' : 'Failed'),
      })
    } catch (err) {
      setDbStatus({ ok: false, message: (err as Error).message })
    } finally {
      setDbLoading(false)
    }
  }

  const handleDbSave = async () => {
    setDbLoading(true)
    setDbStatus(null)
    try {
      const url = dbType === 'sqlite' ? 'file:noob-sdet.db' : dbUrl.trim()
      const res = await api.dbConfig.update({
        type: dbType,
        url,
        token: dbToken.trim() || undefined,
        ...(dbType === 'postgres' ? { poolMax: parseInt(dbPoolMax, 10) || 10 } : {}),
      })
      if (res.ok || res.type) {
        setCurrentDbType(dbType)
        setDbStatus({ ok: true, message: res.message ?? 'Configuration saved.' })
      } else setDbStatus({ ok: false, message: res.error ?? 'Failed to save.' })
    } catch (err) {
      setDbStatus({ ok: false, message: (err as Error).message })
    } finally {
      setDbLoading(false)
    }
  }

  // ── Cache handlers ──────────────────────────────────────────────────────────
  const openCacheDialog = async () => {
    setCacheStatus(null)
    setCacheLoading(true)
    try {
      const cfg = await api.cacheConfig.get()
      setCurrentCacheType(cfg.active)
      setCacheType(cfg.type as 'none' | 'lru' | 'redis')
      setCacheLruMax(String(cfg.lruMax ?? 500))
      setCacheRedisUrl(cfg.redisUrl ?? '')
      setCacheTtl(String(cfg.ttl ?? 30))
    } catch {
      /* ignore */
    } finally {
      setCacheLoading(false)
    }
    setCacheDialogOpen(true)
  }

  const handleCacheTest = async () => {
    setCacheLoading(true)
    setCacheStatus(null)
    try {
      const res = await api.cacheConfig.test({
        type: cacheType,
        redisUrl: cacheType === 'redis' ? cacheRedisUrl.trim() : undefined,
      })
      setCacheStatus({
        ok: res.ok,
        message: res.error ?? res.message ?? (res.ok ? 'OK' : 'Failed'),
      })
    } catch (err) {
      setCacheStatus({ ok: false, message: (err as Error).message })
    } finally {
      setCacheLoading(false)
    }
  }

  const handleCacheSave = async () => {
    setCacheLoading(true)
    setCacheStatus(null)
    try {
      const res = await api.cacheConfig.update({
        type: cacheType,
        lruMax: parseInt(cacheLruMax, 10) || 500,
        redisUrl: cacheType === 'redis' ? cacheRedisUrl.trim() : undefined,
        ttl: parseInt(cacheTtl, 10) || 30,
      })
      if (res.ok) {
        setCurrentCacheType(cacheType)
        setCacheStatus({ ok: true, message: res.message ?? 'Cache configuration saved.' })
      } else setCacheStatus({ ok: false, message: res.error ?? 'Failed to save.' })
    } catch (err) {
      setCacheStatus({ ok: false, message: (err as Error).message })
    } finally {
      setCacheLoading(false)
    }
  }

  // ── Global tags handlers ────────────────────────────────────────────────────
  const openGlobalTags = async () => {
    setGlobalTagsOpen(true)
    setTagCreateError('')
    setNewTagName('')
    setGlobalTagsLoading(true)
    try {
      const list = await api.globalTags.list()
      setGlobalTagList(list)
    } catch {
      /* ignore */
    } finally {
      setGlobalTagsLoading(false)
    }
  }

  const handleCreateGlobalTag = async () => {
    if (!newTagName.trim() || tagCreating) return
    const trimmed = newTagName.trim()
    if (globalTagList.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setTagCreateError('A global tag with this name already exists')
      return
    }
    setTagCreating(true)
    setTagCreateError('')
    try {
      const created = await api.globalTags.create({ name: trimmed, color: newTagColor })
      setGlobalTagList((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewTagName('')
    } catch (err) {
      setTagCreateError((err as Error).message)
    } finally {
      setTagCreating(false)
    }
  }

  const handleDeleteGlobalTag = async (tagId: number) => {
    try {
      await api.globalTags.delete(tagId)
      setGlobalTagList((prev) => prev.filter((t) => t.id !== tagId))
    } catch {
      /* ignore */
    }
  }

  // ── DB badge label ──────────────────────────────────────────────────────────
  const dbBadge =
    currentDbType === 'sqlite'
      ? 'SQLite (local file)'
      : currentDbType === 'turso'
        ? 'Turso (cloud)'
        : 'PostgreSQL'
  const cacheBadge =
    currentCacheType === 'none'
      ? 'No cache'
      : currentCacheType === 'lru'
        ? 'LRU (in-memory)'
        : 'Redis'
  const authBadge = currentAuthMode === 'email' ? 'Email link reset' : 'Admin-managed reset'
  const ssoBadge =
    currentSsoProvider === 'oidc'
      ? 'OIDC enabled'
      : currentSsoProvider === 'github'
        ? 'GitHub OAuth'
        : 'Disabled'

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--t-text-primary)' }}>
          Admin Settings
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--t-text-muted)' }}>
          Configure database, caching, and authentication for this instance.
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <SettingCard
          icon={<Database size={20} />}
          title="Database Connection"
          description="Switch between SQLite (local), Turso (cloud), or PostgreSQL."
          badge={dbBadge}
          onConfigure={openDbDialog}
        />
        <SettingCard
          icon={<Lightning size={20} />}
          title="Cache Settings"
          description="None (always fresh), LRU (single-server), or Redis (multi-server)."
          badge={cacheBadge}
          onConfigure={openCacheDialog}
        />
        {isSuperAdmin && (
          <SettingCard
            icon={<GearSix size={20} />}
            title="Auth Config"
            description="Control password reset mode and session duration."
            badge={authBadge}
            onConfigure={() => setAuthConfigOpen(true)}
          />
        )}
        {isSuperAdmin && (
          <SettingCard
            icon={<ShieldCheck size={20} />}
            title="Single Sign-On (SSO)"
            description="Configure OIDC or GitHub OAuth for SSO login."
            badge={ssoBadge}
            onConfigure={() => setSsoConfigOpen(true)}
          />
        )}
        <SettingCard
          icon={<Palette size={20} />}
          title="Themes"
          description="Customise colours, fonts and border radius for the entire app."
          badge={theme.name}
          onConfigure={() => {
            setDraftTheme({ ...theme })
            setThemeDialogOpen(true)
          }}
        />
        <SettingCard
          icon={<PaintBrush size={20} />}
          title="Customisation"
          description="Set the app title and icon shown on the login screen and in the header bar after login."
          badge={branding.iconData ? `Icon + ${branding.appTitle}` : branding.appTitle}
          onConfigure={openCustom}
        />
        {isSuperAdmin && (
          <SettingCard
            icon={<Tag size={20} />}
            title="Global Tags"
            description="Define tags available across all spaces and apps. Space tags cannot duplicate these."
            badge={`${globalTagList.length} tag${globalTagList.length !== 1 ? 's' : ''}`}
            onConfigure={openGlobalTags}
          />
        )}
        <SettingCard
          icon={<HardDrives size={20} />}
          title="Client Cache"
          description="In-browser SWR cache for apps, spaces, folders, tests and runs. Clear to force a fresh fetch."
          badge={`${buildCacheEntries().reduce((s, e) => s + e.size, 0)} entries`}
          onConfigure={openClientCache}
        />
      </div>

      {/* ── Database modal ───────────────────────────────────────────────────── */}
      {dbDialogOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setDbDialogOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 12,
              padding: 28,
              width: 480,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Database size={16} weight="fill" color="var(--t-text-secondary)" />
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--t-text-primary)',
                    }}
                  >
                    Database Connection
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>
                    SQLite, Turso, or PostgreSQL
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDbDialogOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--t-text-muted)',
                  display: 'flex',
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['sqlite', 'turso', 'postgres'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setDbType(t)
                    setDbStatus(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: 8,
                    border:
                      dbType === t
                        ? '1px solid var(--t-border-strong)'
                        : '1px solid var(--t-border-default)',
                    background: dbType === t ? 'var(--t-bg-surface)' : 'transparent',
                    color: dbType === t ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.12s',
                    position: 'relative',
                  }}
                >
                  <Database size={18} weight={dbType === t ? 'fill' : 'regular'} />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>
                    {t === 'sqlite' ? 'SQLite' : t === 'turso' ? 'Turso' : 'PostgreSQL'}
                  </span>
                  {currentDbType === t && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--t-accent-success)',
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
            {dbType === 'sqlite' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>Storage</Label>
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--t-bg-base)',
                    border: '1px solid var(--t-border-default)',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'var(--t-text-muted)',
                    fontFamily: 'monospace',
                  }}
                >
                  file: noob-sdet.db (local)
                </div>
              </div>
            )}
            {dbType === 'turso' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Database URL <span style={{ color: 'var(--t-accent-danger)' }}>*</span>
                  </Label>
                  <Input
                    value={dbUrl}
                    onChange={(e) => {
                      setDbUrl(e.target.value)
                      setDbStatus(null)
                    }}
                    placeholder="libsql://your-db.turso.io"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Auth Token
                  </Label>
                  <Input
                    type="password"
                    value={dbToken}
                    onChange={(e) => {
                      setDbToken(e.target.value)
                      setDbStatus(null)
                    }}
                    placeholder="eyJ… (leave blank if none)"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                </div>
              </div>
            )}
            {dbType === 'postgres' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Connection String <span style={{ color: 'var(--t-accent-danger)' }}>*</span>
                  </Label>
                  <Input
                    value={dbUrl}
                    onChange={(e) => {
                      setDbUrl(e.target.value)
                      setDbStatus(null)
                    }}
                    placeholder="postgresql://user:pass@host:5432/db"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>
                    Supports Neon, Supabase, RDS, Aurora, and self-hosted PostgreSQL.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Max Pool Connections
                  </Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={dbPoolMax}
                      onChange={(e) => {
                        setDbPoolMax(e.target.value)
                        setDbStatus(null)
                      }}
                      style={{ width: 80, fontFamily: 'monospace', fontSize: 13 }}
                    />
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--t-text-muted)' }}>
                      Connections in the pool (default 10).
                    </p>
                  </div>
                </div>
              </div>
            )}
            {dbStatus && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: dbStatus.ok ? 'rgba(34,197,94,0.08)' : 'rgba(229,72,77,0.08)',
                  border: `1px solid ${dbStatus.ok ? 'rgba(34,197,94,0.2)' : 'rgba(229,72,77,0.2)'}`,
                  fontSize: 13,
                  color: dbStatus.ok ? 'var(--t-accent-success)' : 'var(--t-accent-danger)',
                }}
              >
                {dbStatus.ok ? (
                  <CheckCircle size={15} weight="fill" />
                ) : (
                  <Warning size={15} weight="fill" />
                )}
                {dbStatus.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setDbDialogOpen(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                disabled={dbLoading || (dbType !== 'sqlite' && !dbUrl.trim())}
                onClick={handleDbTest}
              >
                {dbLoading ? 'Testing…' : 'Test Connection'}
              </Button>
              <Button
                disabled={dbLoading || (dbType !== 'sqlite' && !dbUrl.trim())}
                onClick={handleDbSave}
              >
                {dbLoading ? 'Saving…' : 'Save & Apply'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cache modal ──────────────────────────────────────────────────────── */}
      {cacheDialogOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setCacheDialogOpen(false)}
        >
          <div
            style={{
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-subtle)',
              borderRadius: 12,
              padding: 24,
              width: 420,
              maxWidth: '90vw',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Lightning size={16} weight="fill" color="var(--t-text-secondary)" />
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--t-text-primary)',
                    }}
                  >
                    Cache Settings
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>
                    None, LRU, or Redis
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCacheDialogOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--t-text-muted)',
                  display: 'flex',
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['none', 'lru', 'redis'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setCacheType(t)
                    setCacheStatus(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 4px',
                    borderRadius: 8,
                    border:
                      cacheType === t
                        ? '1px solid var(--t-border-strong)'
                        : '1px solid var(--t-border-default)',
                    background: cacheType === t ? 'var(--t-bg-surface)' : 'transparent',
                    color: cacheType === t ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    position: 'relative',
                  }}
                >
                  <Lightning size={18} weight={cacheType === t ? 'fill' : 'regular'} />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>
                    {t === 'none' ? 'None' : t === 'lru' ? 'LRU' : 'Redis'}
                  </span>
                  {currentCacheType === t && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--t-accent-success)',
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
            {cacheType === 'none' && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text-muted)' }}>
                Every request goes directly to the database. No stale data, no setup required.
              </p>
            )}
            {cacheType === 'lru' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Max Entries
                  </Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Input
                      type="number"
                      min={10}
                      max={10000}
                      value={cacheLruMax}
                      onChange={(e) => {
                        setCacheLruMax(e.target.value)
                        setCacheStatus(null)
                      }}
                      style={{ width: 90, fontFamily: 'monospace', fontSize: 13 }}
                    />
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--t-text-muted)' }}>
                      Max cached items (default 500). Oldest evicted when full.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    TTL (seconds)
                  </Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Input
                      type="number"
                      min={1}
                      max={3600}
                      value={cacheTtl}
                      onChange={(e) => {
                        setCacheTtl(e.target.value)
                        setCacheStatus(null)
                      }}
                      style={{ width: 90, fontFamily: 'monospace', fontSize: 13 }}
                    />
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--t-text-muted)' }}>
                      How long entries stay fresh (default 30 s).
                    </p>
                  </div>
                </div>
              </div>
            )}
            {cacheType === 'redis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    Redis URL <span style={{ color: 'var(--t-accent-danger)' }}>*</span>
                  </Label>
                  <Input
                    value={cacheRedisUrl}
                    onChange={(e) => {
                      setCacheRedisUrl(e.target.value)
                      setCacheStatus(null)
                    }}
                    placeholder="redis://localhost:6379"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>
                    Supports local Redis, Upstash, Valkey, and self-hosted instances.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={{ color: 'var(--t-text-secondary)', fontSize: 12 }}>
                    TTL (seconds)
                  </Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Input
                      type="number"
                      min={1}
                      max={3600}
                      value={cacheTtl}
                      onChange={(e) => {
                        setCacheTtl(e.target.value)
                        setCacheStatus(null)
                      }}
                      style={{ width: 90, fontFamily: 'monospace', fontSize: 13 }}
                    />
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--t-text-muted)' }}>
                      How long entries stay fresh (default 30 s).
                    </p>
                  </div>
                </div>
              </div>
            )}
            {cacheStatus && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: cacheStatus.ok ? 'rgba(34,197,94,0.08)' : 'rgba(229,72,77,0.08)',
                  border: `1px solid ${cacheStatus.ok ? 'rgba(34,197,94,0.2)' : 'rgba(229,72,77,0.2)'}`,
                  fontSize: 13,
                  color: cacheStatus.ok ? 'var(--t-accent-success)' : 'var(--t-accent-danger)',
                }}
              >
                {cacheStatus.ok ? (
                  <CheckCircle size={15} weight="fill" />
                ) : (
                  <Warning size={15} weight="fill" />
                )}
                {cacheStatus.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setCacheDialogOpen(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                disabled={cacheLoading || (cacheType === 'redis' && !cacheRedisUrl.trim())}
                onClick={handleCacheTest}
              >
                {cacheLoading ? 'Testing…' : 'Test Connection'}
              </Button>
              <Button
                disabled={cacheLoading || (cacheType === 'redis' && !cacheRedisUrl.trim())}
                onClick={handleCacheSave}
              >
                {cacheLoading ? 'Saving…' : 'Save & Apply'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Auth config modal ────────────────────────────────────────────────── */}
      {isSuperAdmin && (
        <AuthConfigDialog open={authConfigOpen} onClose={() => setAuthConfigOpen(false)} />
      )}

      {/* ── SSO config modal ─────────────────────────────────────────────────── */}
      {isSuperAdmin && (
        <SsoConfigDialog
          open={ssoConfigOpen}
          onClose={() => setSsoConfigOpen(false)}
          onSaved={(provider) => setCurrentSsoProvider(provider)}
        />
      )}

      {(false as const) && isSuperAdmin && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setGroupsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#111',
              border: '1px solid #222',
              borderRadius: 12,
              width: 760,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #1e1e1e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#ededed' }}>Groups</h2>
              <button
                onClick={() => setGroupsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>
            {groupError && (
              <div
                style={{
                  margin: '8px 24px 0',
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: 'rgba(229,72,77,0.08)',
                  border: '1px solid rgba(229,72,77,0.2)',
                  fontSize: 13,
                  color: '#e5484d',
                }}
              >
                {groupError}
              </div>
            )}
            {/* Body — split: group list left, members right */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left: group list */}
              <div
                style={{
                  width: 260,
                  borderRight: '1px solid #1e1e1e',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
                  <Button
                    size="sm"
                    variant="outline"
                    style={{ width: '100%', gap: 6 }}
                    onClick={() => {
                      setGroupCreateMode(true)
                      setGroupError(null)
                    }}
                  >
                    <Plus size={14} /> New Group
                  </Button>
                </div>
                {groupCreateMode && (
                  <div
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid #1a1a1a',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <Input
                      placeholder="Group name"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      style={{ fontSize: 13 }}
                      autoFocus
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      style={{ fontSize: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                        Create
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setGroupCreateMode(false)
                          setGroupError(null)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {groupsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <SkeletonSidebarItem key={i} i={i} />)
                  ) : groups.length === 0 ? (
                    <p style={{ padding: 16, fontSize: 13, color: '#555', margin: 0 }}>
                      No groups yet.
                    </p>
                  ) : (
                    groups.map((g) => (
                      <div
                        key={g.id}
                        onClick={() => selectGroup(g)}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          background:
                            selectedGroup?.id === g.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid #141414',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>
                            {g.name}
                          </div>
                          {g.description && (
                            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                              {g.description}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteGroup(g.id)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#555',
                            cursor: 'pointer',
                            padding: 4,
                            opacity: 0.7,
                          }}
                          title="Delete group"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {/* Right: members panel */}
              <div
                style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                {!selectedGroup ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <p style={{ fontSize: 13, color: '#444', margin: 0 }}>
                      Select a group to manage its members.
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e1e' }}>
                      {groupEditMode ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <Input
                            value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                            style={{ fontSize: 13 }}
                          />
                          <Input
                            value={editGroupDesc}
                            onChange={(e) => setEditGroupDesc(e.target.value)}
                            placeholder="Description"
                            style={{ fontSize: 12 }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button size="sm" onClick={handleSaveGroupEdit}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setGroupEditMode(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#ededed' }}>
                              {selectedGroup.name}
                            </div>
                            {selectedGroup.description && (
                              <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                                {selectedGroup.description}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setGroupEditMode(true)
                              setEditGroupName(selectedGroup.name)
                              setEditGroupDesc(selectedGroup.description ?? '')
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#666',
                              cursor: 'pointer',
                              padding: 4,
                            }}
                            title="Edit group"
                          >
                            <PencilSimple size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        padding: '10px 20px',
                        borderBottom: '1px solid #1a1a1a',
                        position: 'relative',
                      }}
                    >
                      <Input
                        placeholder="Search users to add…"
                        value={addMemberEmail}
                        onChange={(e) => searchUsers(e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                      {userSearchResults.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 20,
                            right: 20,
                            top: '100%',
                            background: '#161616',
                            border: '1px solid #222',
                            borderRadius: 6,
                            zIndex: 10,
                            overflow: 'hidden',
                          }}
                        >
                          {userSearchResults
                            .filter((u) => !groupMembers.some((m) => m.userId === u.id))
                            .map((u) => (
                              <div
                                key={u.id}
                                onClick={() => addGroupMember(u.id)}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: 13,
                                  color: '#ccc',
                                  borderBottom: '1px solid #1a1a1a',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#222')}
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background = 'transparent')
                                }
                              >
                                {u.name || u.email}{' '}
                                <span style={{ color: '#555', fontSize: 11 }}>({u.email})</span>
                                {userSearchLoading && <span style={{ color: '#555' }}> …</span>}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {groupMembersLoading ? (
                        <SkeletonRows count={3} rowHeight={40} padding="8px 16px" iconSize={24} />
                      ) : groupMembers.length === 0 ? (
                        <p style={{ padding: 16, fontSize: 13, color: '#555', margin: 0 }}>
                          No members yet — search above to add.
                        </p>
                      ) : (
                        groupMembers.map((m) => (
                          <div
                            key={m.id}
                            style={{
                              padding: '10px 20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderBottom: '1px solid #141414',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, color: '#ddd' }}>{m.name || m.email}</div>
                              <div style={{ fontSize: 11, color: '#555' }}>{m.email}</div>
                            </div>
                            <button
                              onClick={() => removeGroupMember(m.userId)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#555',
                                cursor: 'pointer',
                                padding: 4,
                              }}
                              title="Remove from group"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Global Tags modal ───────────────────────────────────────────────── */}
      {globalTagsOpen && isSuperAdmin && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setGlobalTagsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 12,
              width: 480,
              maxHeight: '80vh',
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
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--t-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Tag size={16} color="var(--t-text-secondary)" />
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--t-text-primary)',
                    }}
                  >
                    Global Tags
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>
                    Available across all spaces
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGlobalTagsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--t-text-muted)',
                  display: 'flex',
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Create new tag */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--t-border-subtle)' }}>
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--t-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Add New Tag
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  title="Pick tag color"
                  style={{
                    width: 36,
                    height: 36,
                    padding: 2,
                    borderRadius: 6,
                    border: '1px solid var(--t-border-default)',
                    background: 'var(--t-bg-elevated)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />
                <Input
                  value={newTagName}
                  onChange={(e) => {
                    setNewTagName(e.target.value)
                    setTagCreateError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateGlobalTag()
                  }}
                  placeholder="Tag name…"
                  style={{ flex: 1 }}
                />
                <Button
                  onClick={handleCreateGlobalTag}
                  disabled={!newTagName.trim() || tagCreating}
                  style={{ gap: 6, flexShrink: 0 }}
                >
                  <Plus size={14} />
                  {tagCreating ? 'Adding…' : 'Add'}
                </Button>
              </div>
              {tagCreateError && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--t-accent-danger)' }}>
                  {tagCreateError}
                </p>
              )}
            </div>

            {/* Tag list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 20px' }}>
              {globalTagsLoading ? (
                <SkeletonRows count={4} rowHeight={40} padding="6px 0" showIcon={false} />
              ) : globalTagList.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--t-text-muted)', padding: '8px 0' }}>
                  No global tags yet. Add one above.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {globalTagList.map((tag) => (
                    <div
                      key={tag.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'var(--t-bg-surface)',
                        border: '1px solid var(--t-border-subtle)',
                      }}
                    >
                      <TagPill name={tag.name} color={tag.color} />
                      <button
                        onClick={() => handleDeleteGlobalTag(tag.id)}
                        title="Delete global tag"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--t-text-muted)',
                          display: 'flex',
                          padding: 4,
                          borderRadius: 4,
                          transition: 'color 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--t-accent-danger)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--t-text-muted)'
                        }}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--t-border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Button variant="outline" onClick={() => setGlobalTagsOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Client Cache modal ──────────────────────────────────────────────── */}
      {clientCacheOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setClientCacheOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 12,
              width: 480,
              maxHeight: '80vh',
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
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--t-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <HardDrives size={16} color="var(--t-text-secondary)" />
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--t-text-primary)',
                    }}
                  >
                    Client Cache
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>
                    {totalClientCacheEntries} entr{totalClientCacheEntries !== 1 ? 'ies' : 'y'}{' '}
                    cached in this browser session
                  </p>
                </div>
              </div>
              <button
                onClick={() => setClientCacheOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--t-text-muted)',
                  display: 'flex',
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Cache list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: 11,
                  color: 'var(--t-text-muted)',
                  lineHeight: 1.5,
                }}
              >
                Each row shows how many keyed slices are currently cached for that resource.
                Clearing a cache forces the next navigation to re-fetch from the server instead of
                serving stale data.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cacheEntries.map((entry, i) => (
                  <div
                    key={entry.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--t-bg-surface)',
                      border: '1px solid var(--t-border-subtle)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--t-text-primary)',
                        }}
                      >
                        {entry.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 1 }}>
                        {entry.description}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexShrink: 0,
                        marginLeft: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: entry.size > 0 ? 'var(--t-text-secondary)' : 'var(--t-text-muted)',
                          minWidth: 20,
                          textAlign: 'right',
                        }}
                      >
                        {entry.size}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={entry.size === 0}
                        onClick={() => handleClearOne(i)}
                        style={{ fontSize: 11, padding: '3px 10px', height: 'auto' }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--t-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Button
                variant="outline"
                disabled={totalClientCacheEntries === 0}
                onClick={handleClearAll}
                style={{ gap: 6 }}
              >
                <Trash size={14} />
                Clear All
              </Button>
              <Button variant="outline" onClick={() => setClientCacheOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Customisation modal ─────────────────────────────────────────────── */}
      {customOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setCustomOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 12,
              width: 460,
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
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--t-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PaintBrush size={16} color="var(--t-text-secondary)" />
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--t-text-primary)',
                    }}
                  >
                    Customisation
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>
                    App title &amp; icon
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCustomOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--t-text-muted)',
                  display: 'flex',
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div
              style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              {/* Live preview */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '18px 16px',
                  borderRadius: 10,
                  background: 'var(--t-bg-surface)',
                  border: '1px solid var(--t-border-subtle)',
                }}
              >
                {draftIcon ? (
                  <img
                    src={draftIcon}
                    alt="App icon preview"
                    style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 10 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: 'var(--t-bg-elevated)',
                      border: '1px solid var(--t-border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--t-text-secondary)',
                    }}
                  >
                    {(draftTitle || 'N').charAt(0).toUpperCase()}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--t-text-primary)',
                  }}
                >
                  {draftTitle || 'noob-sdet'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                  Login screen preview
                </div>
              </div>

              {/* App title */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>App Title</Label>
                <Input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="noob-sdet"
                  maxLength={40}
                />
              </div>

              {/* Icon — file upload */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>App Icon</Label>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--t-text-muted)' }}>
                  Upload an SVG or PNG (max ~512 KB). Shown on the login screen and in the top
                  header bar after login. Recommended: square image, 64×64 px or larger (SVG scales
                  perfectly at any size).
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      borderRadius: 7,
                      border: '1px solid var(--t-border-default)',
                      background: 'var(--t-bg-elevated)',
                      color: 'var(--t-text-secondary)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'border-color 0.1s, color 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-strong)'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-primary)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.borderColor =
                        'var(--t-border-default)'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
                    }}
                  >
                    <Plus size={13} />
                    {draftIcon ? 'Replace icon' : 'Upload icon'}
                    <input
                      type="file"
                      accept="image/svg+xml,image/png"
                      style={{ display: 'none' }}
                      onChange={handleIconFileChange}
                    />
                  </label>
                  {draftIcon && (
                    <button
                      onClick={() => setDraftIcon(null)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '7px 12px',
                        borderRadius: 7,
                        border: '1px solid var(--t-border-default)',
                        background: 'none',
                        color: 'var(--t-accent-danger)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <X size={12} />
                      Remove icon
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 24px',
                borderTop: '1px solid var(--t-border-subtle)',
              }}
            >
              <button
                onClick={handleCustomReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: 'none',
                  color: 'var(--t-text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: 6,
                  transition: 'color 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--t-text-secondary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--t-text-muted)'
                }}
              >
                <ArrowCounterClockwise size={14} />
                Reset to default
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="outline" onClick={() => setCustomOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleCustomSave()}
                  disabled={customSaving || !draftTitle.trim()}
                >
                  {customSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Themes modal ────────────────────────────────────────────────────── */}
      {themeDialogOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setThemeDialogOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              borderRadius: 14,
              width: 680,
              maxHeight: '90vh',
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
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--t-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Palette size={16} color="var(--t-text-secondary)" />
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--t-text-primary)',
                    }}
                  >
                    Themes
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>
                    Customise colors, fonts and shape
                  </p>
                </div>
              </div>
              <button
                onClick={() => setThemeDialogOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--t-text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {/* Presets */}
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--t-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Presets
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyDraft(preset)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: `1px solid ${draftTheme.name === preset.name ? 'var(--t-border-strong)' : 'var(--t-border-default)'}`,
                      background:
                        draftTheme.name === preset.name ? 'var(--t-bg-surface)' : 'transparent',
                      color:
                        draftTheme.name === preset.name
                          ? 'var(--t-text-primary)'
                          : 'var(--t-text-muted)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.1s',
                    }}
                  >
                    {/* Mini color swatch strip */}
                    <span style={{ display: 'flex', gap: 3 }}>
                      {[preset.bgBase, preset.bgPanel, preset.textPrimary, preset.accentDanger].map(
                        (c, i) => (
                          <span
                            key={i}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 3,
                              background: c,
                              border: '1px solid rgba(255,255,255,0.1)',
                            }}
                          />
                        )
                      )}
                    </span>
                    {preset.name}
                  </button>
                ))}
              </div>

              {/* Color groups */}
              {(
                [
                  {
                    label: 'Backgrounds',
                    fields: [
                      { key: 'bgBase', label: 'Base' },
                      { key: 'bgSurface', label: 'Surface' },
                      { key: 'bgPanel', label: 'Panel' },
                      { key: 'bgElevated', label: 'Elevated' },
                      { key: 'bgHover', label: 'Hover' },
                    ],
                  },
                  {
                    label: 'Borders',
                    fields: [
                      { key: 'borderSubtle', label: 'Subtle' },
                      { key: 'borderDefault', label: 'Default' },
                      { key: 'borderStrong', label: 'Strong' },
                    ],
                  },
                  {
                    label: 'Text',
                    fields: [
                      { key: 'textPrimary', label: 'Primary' },
                      { key: 'textSecondary', label: 'Secondary' },
                      { key: 'textMuted', label: 'Muted' },
                    ],
                  },
                  {
                    label: 'Accents',
                    fields: [
                      { key: 'accentDanger', label: 'Danger' },
                      { key: 'accentSuccess', label: 'Success' },
                      { key: 'accentWarning', label: 'Warning' },
                      { key: 'accentBlocked', label: 'Blocked' },
                    ],
                  },
                ] as { label: string; fields: { key: keyof AppTheme; label: string }[] }[]
              ).map((group) => (
                <div key={group.label} style={{ marginBottom: 22 }}>
                  <p
                    style={{
                      margin: '0 0 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--t-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {group.label}
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: 10,
                    }}
                  >
                    {group.fields.map(({ key, label }) => (
                      <div key={key}>
                        <p
                          style={{ margin: '0 0 5px', fontSize: 11, color: 'var(--t-text-muted)' }}
                        >
                          {label}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="color"
                            value={
                              String(draftTheme[key]).startsWith('#')
                                ? String(draftTheme[key]).slice(0, 7)
                                : '#000000'
                            }
                            onChange={(e) =>
                              applyDraft({ [key]: e.target.value } as Partial<AppTheme>)
                            }
                            style={{
                              width: 32,
                              height: 32,
                              padding: 2,
                              borderRadius: 6,
                              border: '1px solid var(--t-border-default)',
                              background: 'var(--t-bg-elevated)',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          />
                          <input
                            type="text"
                            value={String(draftTheme[key])}
                            onChange={(e) =>
                              applyDraft({ [key]: e.target.value } as Partial<AppTheme>)
                            }
                            style={{
                              flex: 1,
                              background: 'var(--t-bg-surface)',
                              border: '1px solid var(--t-border-default)',
                              borderRadius: 6,
                              padding: '5px 8px',
                              fontSize: 11,
                              color: 'var(--t-text-secondary)',
                              fontFamily: 'monospace',
                              minWidth: 0,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Typography */}
              <div style={{ marginBottom: 22 }}>
                <p
                  style={{
                    margin: '0 0 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--t-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Typography
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <p style={{ margin: '0 0 5px', fontSize: 11, color: 'var(--t-text-muted)' }}>
                      Sans-serif font stack
                    </p>
                    <input
                      type="text"
                      value={draftTheme.fontSans}
                      onChange={(e) => applyDraft({ fontSans: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'var(--t-bg-surface)',
                        border: '1px solid var(--t-border-default)',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 12,
                        color: 'var(--t-text-secondary)',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px', fontSize: 11, color: 'var(--t-text-muted)' }}>
                      Monospace font stack
                    </p>
                    <input
                      type="text"
                      value={draftTheme.fontMono}
                      onChange={(e) => applyDraft({ fontMono: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'var(--t-bg-surface)',
                        border: '1px solid var(--t-border-default)',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 12,
                        color: 'var(--t-text-secondary)',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Shape */}
              <div style={{ marginBottom: 8 }}>
                <p
                  style={{
                    margin: '0 0 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--t-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Shape
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={draftTheme.radius}
                    onChange={(e) => applyDraft({ radius: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: 'var(--t-text-primary)' }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--t-text-secondary)',
                      minWidth: 48,
                      textAlign: 'right',
                    }}
                  >
                    {draftTheme.radius}px
                  </span>
                  {/* Preview swatch */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: draftTheme.radius,
                      border: '1px solid var(--t-border-strong)',
                      background: 'var(--t-bg-elevated)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 24px',
                borderTop: '1px solid var(--t-border-subtle)',
              }}
            >
              <button
                onClick={handleResetTheme}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: 'none',
                  color: 'var(--t-text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: 6,
                  transition: 'color 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--t-text-secondary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--t-text-muted)'
                }}
              >
                <ArrowCounterClockwise size={14} />
                Reset to default
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="outline" onClick={() => setThemeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveTheme} disabled={themeSaving}>
                  {themeSaving ? 'Saving…' : 'Save Theme'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
