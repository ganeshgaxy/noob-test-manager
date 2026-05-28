import { useEffect, useState } from 'react'
import {
  CaretRight,
  SquaresFour,
  Cube,
  FolderSimple,
  Play,
  GearSix,
  Trash,
  Users,
} from '@phosphor-icons/react'
import { ClipboardProvider } from './contexts/ClipboardContext.js'
import { AuthProvider, useAuth } from './contexts/AuthContext.js'
import { ThemeProvider } from './contexts/ThemeContext.js'
import { LoginView } from './components/LoginView/LoginView.js'
import { ForgotPasswordView } from './components/LoginView/ForgotPasswordView.js'
import { ResetPasswordView } from './components/LoginView/ResetPasswordView.js'
import { Header } from './components/Header/Header.js'
import { Sidebar } from './components/Sidebar/Sidebar.js'
import { AppsView } from './components/AppsView/AppsView.js'
import { SpaceView } from './components/SpaceView/SpaceView.js'
import { TestEditor } from './components/TestEditor/TestEditor.js'
import { RunsView } from './components/RunsView/RunsView.js'
import { RunExecution } from './components/RunExecution/RunExecution.js'
import { SettingsView } from './components/SettingsView/SettingsView.js'
import { TrashView } from './components/TrashView/TrashView.js'
import { UsersView } from './components/UsersView/UsersView.js'
import { UserGroupsView } from './components/UsersView/UserGroupsView.js'
import { AdminSettingsView } from './components/AdminSettingsView/AdminSettingsView.js'
import { TestMuImportDialog } from './components/TestMuImportDialog/TestMuImportDialog.js'
import { useApps } from './features/apps/hooks.js'
import { useSpaces } from './features/spaces/hooks.js'
import { useFolders } from './features/folders/hooks.js'
import { useRuns, useRunExecution } from './features/runs/hooks.js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.js'
import { Input } from '@/components/ui/input.js'
import { Label } from '@/components/ui/label.js'
import { Button } from '@/components/ui/button.js'
import type { View } from './types/index.js'
import { api } from './lib/api.js'
import type { FolderNode } from './types/index.js'
import { parseUrl, viewToUrl } from './lib/routes.js'

// ─── Breadcrumb bar ───────────────────────────────────────────────────────────

function flattenFolders(nodes: FolderNode[]): FolderNode[] {
  return nodes.flatMap((n) => [n, ...flattenFolders(n.children)])
}

interface Crumb {
  label: string
  icon?: React.ReactNode
  onClick: () => void
}

function BreadcrumbBar({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length === 0) return null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 18px',
        height: 34,
        flexShrink: 0,
        borderBottom: '1px solid var(--t-border-subtle)',
        background: 'var(--t-bg-base)',
      }}
    >
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {i > 0 && (
              <CaretRight size={10} color="#666" style={{ flexShrink: 0, margin: '0 2px' }} />
            )}
            <button
              onClick={c.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                border: 'none',
                cursor: isLast ? 'default' : 'pointer',
                background: 'transparent',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 12,
                color: isLast ? 'var(--t-text-primary)' : 'var(--t-text-secondary)',
                fontWeight: isLast ? 500 : 400,
                pointerEvents: isLast ? 'none' : 'auto',
                transition: 'color 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!isLast) (e.currentTarget as HTMLElement).style.color = 'var(--t-text-primary)'
              }}
              onMouseLeave={(e) => {
                if (!isLast)
                  (e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)'
              }}
            >
              {c.icon && (
                <span style={{ display: 'flex', opacity: isLast ? 1 : 0.75 }}>{c.icon}</span>
              )}
              {c.label}
            </button>
          </span>
        )
      })}
    </div>
  )
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthGate() {
  const { user, loading, authScreen } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--t-bg-base)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--t-text-muted)',
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    )
  }

  if (!user) {
    if (authScreen === 'forgot-password') return <ForgotPasswordView />
    if (authScreen === 'reset-password') return <ResetPasswordView />
    return <LoginView />
  }

  return <AppShell />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  )
}

// ─── App shell (authenticated) ────────────────────────────────────────────────

function AppShell() {
  const { user: authUser } = useAuth()
  const [view, setView] = useState<View>(() => parseUrl(window.location.pathname))
  const [addSpaceDialogOpen, setAddSpaceDialogOpen] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceDesc, setNewSpaceDesc] = useState('')
  const [addSpaceSaving, setAddSpaceSaving] = useState(false)
  const [createRunDialogOpen, setCreateRunDialogOpen] = useState(false)
  const [newRunName, setNewRunName] = useState('')
  const [newRunEnv, setNewRunEnv] = useState('')
  const [createRunSaving, setCreateRunSaving] = useState(false)
  const [testMuImportOpen, setTestMuImportOpen] = useState(false)

  // Sync URL → state on browser back/forward
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      const v = e.state as View | null
      setView(v ?? parseUrl(window.location.pathname))
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  // Sync state → URL on every view change
  useEffect(() => {
    const url = viewToUrl(view)
    if (window.location.pathname !== url) {
      window.history.pushState(view, '', url)
    }
  }, [view])

  const activeAppId = 'appId' in view ? view.appId : null
  const activeSpaceId = 'spaceId' in view ? view.spaceId : null
  const activeFolderId = ('folderId' in view ? view.folderId : undefined) ?? undefined
  const activeRunId = view.type === 'run-execution' ? view.runId : null
  const activeTestId = view.type === 'test-editor' ? view.testId : undefined

  const {
    apps,
    loading: appsLoading,
    addApp,
    updateApp,
    removeApp,
    refetch: refetchApps,
  } = useApps()
  const { spaces, addSpace, removeSpace, refetch: refetchSpaces } = useSpaces(activeAppId)

  // Listen for rename events dispatched by Sidebar after API calls complete
  useEffect(() => {
    const handleAppsRefresh = () => void refetchApps()
    const handleSpacesRefresh = () => void refetchSpaces()
    window.addEventListener('sdet:apps:refresh', handleAppsRefresh)
    window.addEventListener('sdet:spaces:refresh', handleSpacesRefresh)
    return () => {
      window.removeEventListener('sdet:apps:refresh', handleAppsRefresh)
      window.removeEventListener('sdet:spaces:refresh', handleSpacesRefresh)
    }
  }, [refetchApps, refetchSpaces])
  const { tree: folderTree } = useFolders(activeSpaceId)
  const { runs, createRun, removeRun, refetch: refetchRuns } = useRuns(activeAppId)
  const {
    results,
    report,
    loading: runLoading,
    markResult,
    markStep: _markStep,
    refetch: refetchRun,
  } = useRunExecution(activeAppId, activeRunId)

  const selectedApp = apps.find((a) => a.id === activeAppId) ?? null
  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? null
  const activeRun = runs.find((r) => r.id === activeRunId) ?? null
  const activeFolder = flattenFolders(folderTree).find((f) => f.id === activeFolderId) ?? null

  const navigate = (v: View) => {
    window.history.pushState(v, '', viewToUrl(v))
    setView(v)
  }

  // ── Access guard — redirect non-super_admin away from restricted views ──────
  const isSuperAdmin = authUser?.globalRole === 'super_admin'
  if (!isSuperAdmin && (view.type === 'admin-settings' || view.type === 'users')) {
    navigate({ type: 'apps' })
    return null
  }

  // ── Redirect to apps if the app referenced in the URL no longer exists ───────
  const appViewTypes = new Set([
    'spaces',
    'tests',
    'test-editor',
    'runs',
    'run-execution',
    'settings',
    'trash',
  ])
  if (!appsLoading && activeAppId !== null && appViewTypes.has(view.type) && !selectedApp) {
    navigate({ type: 'apps' })
    return null
  }

  const handleSetRunStatus = async (status: string) => {
    if (!activeAppId || !activeRunId) return
    await api.runs.setStatus(activeAppId, activeRunId, status)
    await refetchRuns()
    await refetchRun()
  }

  // ── Build breadcrumbs from current view ──────────────────────────────────
  const crumbs: Crumb[] = []

  if (view.type !== 'apps' && view.type !== 'admin-settings') {
    crumbs.push({ label: 'Apps', onClick: () => navigate({ type: 'apps' }) })
  }
  if (selectedApp && view.type !== 'apps') {
    crumbs.push({
      label: selectedApp.name,
      icon: <SquaresFour size={11} />,
      onClick: () => navigate({ type: 'spaces', appId: selectedApp.id }),
    })
  }
  if (
    activeSpace &&
    (view.type === 'tests' || view.type === 'test-editor' || view.type === 'trash')
  ) {
    crumbs.push({
      label: activeSpace.name,
      icon: <Cube size={11} />,
      onClick: () => navigate({ type: 'tests', appId: selectedApp!.id, spaceId: activeSpace.id }),
    })
  }
  if (activeFolder && (view.type === 'tests' || view.type === 'test-editor')) {
    crumbs.push({
      label: activeFolder.name,
      icon: <FolderSimple size={11} />,
      onClick: () =>
        navigate({
          type: 'tests',
          appId: selectedApp!.id,
          spaceId: activeSpace!.id,
          folderId: activeFolder.id,
        }),
    })
  }
  if (view.type === 'runs' || view.type === 'run-execution') {
    crumbs.push({
      label: 'Runs',
      icon: <Play size={11} />,
      onClick: () => navigate({ type: 'runs', appId: selectedApp!.id }),
    })
  }
  if (view.type === 'run-execution' && activeRun) {
    crumbs.push({ label: activeRun.name, icon: <Play size={11} />, onClick: () => {} })
  }
  if (view.type === 'settings') {
    crumbs.push({
      label: view.section === 'members' ? 'Members' : 'Settings',
      icon: <GearSix size={11} />,
      onClick: () => {},
    })
  }
  if (view.type === 'users') {
    crumbs.push({
      label: view.section === 'user-groups' ? 'User Groups' : 'Users',
      icon: <Users size={11} />,
      onClick: () => {},
    })
  }
  if (view.type === 'trash') {
    crumbs.push({ label: 'Trash', icon: <Trash size={11} />, onClick: () => {} })
  }

  return (
    <ClipboardProvider>
      <div
        className="flex flex-col h-screen overflow-hidden"
        style={{ background: 'var(--t-bg-base)' }}
      >
        <Header />
        <BreadcrumbBar crumbs={crumbs} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            apps={apps}
            selectedApp={selectedApp}
            spaces={spaces}
            runs={runs}
            view={view}
            onNavigate={navigate}
            onAddApp={addApp}
            onDeleteApp={removeApp}
            onAddSpace={async (d) => {
              await addSpace(d)
              await refetchSpaces()
            }}
            onDeleteSpace={async (id) => {
              await removeSpace(id)
              await refetchSpaces()
            }}
            onCreateRun={async (d) => createRun({ ...d, createdBy: 'me' })}
            onDeleteRun={removeRun}
            onDuplicateRun={async (runId) => {
              if (activeAppId) {
                await api.runs.duplicate(activeAppId, runId)
                await refetchRuns()
              }
            }}
          />

          {view.type === 'apps' && (
            <AppsView
              apps={apps}
              onNavigate={navigate}
              onAdd={addApp}
              onRename={updateApp}
              onDelete={removeApp}
            />
          )}

          {(view.type === 'spaces' || view.type === 'tests') && activeAppId && (
            <SpaceView
              appId={activeAppId}
              activeSpaceId={activeSpaceId ?? undefined}
              activeFolderId={activeFolderId}
              selectedTestId={view.type === 'tests' ? (view.selectedTestId ?? null) : null}
              onSelectTest={(testId) => {
                if (view.type === 'tests' && view.folderId != null) {
                  navigate({ ...view, selectedTestId: testId ?? undefined })
                }
              }}
              onNavigate={navigate}
              onImportFromTestMu={() => setTestMuImportOpen(true)}
              onImportFromTestRail={() => {
                // TODO: implement TestRail import
                alert('Import from TestRail — coming soon')
              }}
              onImportFromCsv={() => {
                // TODO: implement CSV import
                alert('Import from CSV — coming soon')
              }}
              onAddFolder={() => {
                window.dispatchEvent(new CustomEvent('sdet:open:add-folder'))
              }}
              onAddSpace={() => {
                setNewSpaceName('')
                setNewSpaceDesc('')
                setAddSpaceDialogOpen(true)
              }}
            />
          )}

          {view.type === 'test-editor' && (
            <TestEditor
              folderId={view.folderId}
              testId={activeTestId}
              appId={view.appId}
              spaceId={view.spaceId}
              onNavigate={navigate}
              onSaved={() => {}}
            />
          )}

          {view.type === 'runs' && activeAppId && (
            <RunsView
              appId={activeAppId}
              onNavigate={navigate}
              onCreateRun={() => {
                setNewRunName('')
                setNewRunEnv('')
                setCreateRunDialogOpen(true)
              }}
            />
          )}

          {view.type === 'run-execution' && (
            <RunExecution
              run={activeRun}
              results={results}
              report={report}
              loading={runLoading}
              appId={view.appId}
              spaces={spaces}
              onNavigate={navigate}
              onMarkResult={markResult}
              onSetRunStatus={handleSetRunStatus}
              onRefreshResults={refetchRun}
            />
          )}

          {view.type === 'settings' && (
            <SettingsView
              appId={view.appId}
              appName={selectedApp?.name ?? 'App'}
              section={view.section}
            />
          )}

          {view.type === 'trash' && <TrashView spaceId={view.spaceId} />}

          {view.type === 'users' &&
            (view.section === 'user-groups' ? <UserGroupsView /> : <UsersView />)}

          {view.type === 'admin-settings' && <AdminSettingsView />}
        </div>
      </div>

      {/* ── TestMu Import dialog ── */}
      <TestMuImportDialog
        open={testMuImportOpen}
        onClose={() => setTestMuImportOpen(false)}
        appId={activeAppId}
      />

      {/* ── Add Space dialog (triggered from SpaceView empty state) ── */}
      <Dialog open={addSpaceDialogOpen} onOpenChange={setAddSpaceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Space</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!newSpaceName.trim() || !activeAppId) return
              setAddSpaceSaving(true)
              try {
                await addSpace({
                  name: newSpaceName.trim(),
                  description: newSpaceDesc.trim() || undefined,
                })
                await refetchSpaces()
                setAddSpaceDialogOpen(false)
              } finally {
                setAddSpaceSaving(false)
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>
                Name <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
              </Label>
              <Input
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="e.g. Web App"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>Description</Label>
              <Input
                value={newSpaceDesc}
                onChange={(e) => setNewSpaceDesc(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <DialogFooter style={{ marginTop: 8 }}>
              <Button type="button" variant="outline" onClick={() => setAddSpaceDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addSpaceSaving || !newSpaceName.trim()}>
                {addSpaceSaving ? 'Creating…' : 'Create Space'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create Run dialog (triggered from RunsView empty state) ── */}
      <Dialog open={createRunDialogOpen} onOpenChange={setCreateRunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Run</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!newRunName.trim() || !activeAppId) return
              setCreateRunSaving(true)
              try {
                const run = await createRun({
                  name: newRunName.trim(),
                  environment: newRunEnv.trim() || undefined,
                  createdBy: 'me',
                })
                await refetchRuns()
                setCreateRunDialogOpen(false)
                if (run) navigate({ type: 'run-execution', appId: activeAppId, runId: run.id })
              } finally {
                setCreateRunSaving(false)
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>
                Name <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
              </Label>
              <Input
                value={newRunName}
                onChange={(e) => setNewRunName(e.target.value)}
                placeholder="e.g. Sprint 12 Smoke"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>Environment</Label>
              <Input
                value={newRunEnv}
                onChange={(e) => setNewRunEnv(e.target.value)}
                placeholder="e.g. staging"
              />
            </div>
            <DialogFooter style={{ marginTop: 8 }}>
              <Button type="button" variant="outline" onClick={() => setCreateRunDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRunSaving || !newRunName.trim()}>
                {createRunSaving ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ClipboardProvider>
  )
}
