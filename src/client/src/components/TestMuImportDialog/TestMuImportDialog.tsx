import { useState, useEffect } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  MagnifyingGlass,
  X,
  Package,
  ArrowLeft,
  CheckSquare,
  Square,
  UploadSimple,
  CheckCircle,
  Warning,
  CircleNotch,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TmProject {
  project_id: number | string
  name: string
  description?: string
  test_case_count?: number
}

type ProjectStatus = 'pending' | 'running' | 'done' | 'error'

interface ProjectProgress {
  projectId: string
  name: string
  status: ProjectStatus
  foldersCreated: number
  testsCreated: number
  activity: string
  error?: string
}

type Step = 'credentials' | 'projects' | 'importing' | 'done'

interface Props {
  open: boolean
  onClose: () => void
  appId: number | null
}

// ─── SSE event from server ────────────────────────────────────────────────────

interface ImportEvent {
  type: 'activity' | 'folder-created' | 'test-created' | 'project-done' | 'project-error' | 'done'
  projectId?: string
  msg?: string
  error?: string
}

// ─── Project list fetch (still client-side — just one call) ──────────────────

async function fetchProjects(
  baseUrl: string,
  username: string,
  accessKey: string
): Promise<TmProject[]> {
  const res = await fetch('/api/testmu/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseUrl,
      username,
      accessKey,
      endpoint: '/projects',
      params: { per_page: '100', page: '1' },
    }),
  })
  const data = (await res.json()) as { data?: TmProject[]; projects?: TmProject[]; error?: string }
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data.data ?? data.projects ?? []
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TestMuImportDialog({ open, onClose, appId }: Props) {
  const [step, setStep] = useState<Step>('credentials')
  const [baseUrl, setBaseUrl] = useState('https://test-manager-api.lambdatest.com/api/v1')
  const [username, setUsername] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [projects, setProjects] = useState<TmProject[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<ProjectProgress[]>([])
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep('credentials')
      setSearchError(null)
      setProjects([])
      setSelected(new Set())
      setProgress([])
      setImporting(false)
      setUsername('')
      setAccessKey('')
      setBaseUrl('https://test-manager-api.lambdatest.com/api/v1')
    }
  }, [open])

  const handleSearch = async () => {
    if (!username.trim() || !accessKey.trim()) {
      setSearchError('Username and Access Key are required.')
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const list = await fetchProjects(baseUrl.trim(), username.trim(), accessKey.trim())
      setProjects(list)
      setSelected(new Set())
      setStep('projects')
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Failed to fetch projects')
    } finally {
      setSearching(false)
    }
  }

  const toggleProject = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === projects.length) setSelected(new Set())
    else setSelected(new Set(projects.map((p) => String(p.project_id))))
  }

  const handleImport = async () => {
    if (!appId || selected.size === 0) return

    const toImport = projects.filter((p) => selected.has(String(p.project_id)))
    const initial: ProjectProgress[] = toImport.map((p) => ({
      projectId: String(p.project_id),
      name: p.name,
      status: 'pending' as const,
      foldersCreated: 0,
      testsCreated: 0,
      activity: 'Queued',
    }))
    setProgress(initial)
    setStep('importing')
    setImporting(true)

    // One POST — server does everything, streams SSE back
    const res = await fetch('/api/testmu/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: baseUrl.trim(),
        username: username.trim(),
        accessKey: accessKey.trim(),
        appId,
        projects: toImport,
      }),
    })

    if (!res.body) {
      setImporting(false)
      setStep('done')
      return
    }

    // Parse the SSE stream — project status is driven entirely by SSE events.
    // Projects stay 'pending' / "Queued" until the server actually starts them
    // (PROJECT_CONCURRENCY=1 means only one runs at a time).
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buf += decoder.decode(value, { stream: true })

      // SSE events are delimited by double newline
      const parts = buf.split('\n\n')
      buf = parts.pop() ?? ''

      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        let event: ImportEvent
        try {
          event = JSON.parse(line.slice(5).trim()) as ImportEvent
        } catch {
          continue
        }

        if (event.type === 'done') break

        if (!event.projectId) continue

        const pid = event.projectId

        setProgress((prev) =>
          prev.map((p) => {
            if (p.projectId !== pid) return p
            switch (event.type) {
              case 'activity':
                return { ...p, status: 'running' as const, activity: event.msg ?? p.activity }
              case 'folder-created':
                return { ...p, foldersCreated: p.foldersCreated + 1 }
              case 'test-created':
                return { ...p, testsCreated: p.testsCreated + 1 }
              case 'project-done':
                return { ...p, status: 'done' as const, activity: 'Done' }
              case 'project-error':
                return { ...p, status: 'error' as const, error: event.error ?? 'Import failed' }
              default:
                return p
            }
          })
        )
      }
    }

    setImporting(false)
    setStep('done')
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--t-bg-surface)',
    border: '1px solid var(--t-border-default)',
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: 13,
    color: 'var(--t-text-primary)',
    outline: 'none',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--t-text-muted)',
    marginBottom: 6,
    display: 'block',
  }

  const allSelected = projects.length > 0 && selected.size === projects.length

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(v) => {
        if (!v && !importing) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
            zIndex: 50,
          }}
        />
        <DialogPrimitive.Content
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            zIndex: 51,
            width: 580,
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--t-bg-panel)',
            border: '1px solid var(--t-border-default)',
            borderRadius: 12,
            boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
            maxHeight: 'calc(100vh - 80px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px 14px',
              borderBottom: '1px solid var(--t-border-subtle)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {step === 'projects' && (
                <button
                  onClick={() => setStep('credentials')}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--t-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = 'var(--t-text-muted)')
                  }
                >
                  <ArrowLeft size={14} />
                </button>
              )}
              <div>
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--t-text-primary)',
                    margin: 0,
                  }}
                >
                  Import from TestMu
                </p>
                <p style={{ fontSize: 12, color: 'var(--t-text-muted)', margin: '2px 0 0' }}>
                  {step === 'credentials' && 'Connect to your TestMu workspace'}
                  {step === 'projects' &&
                    `${projects.length} project${projects.length !== 1 ? 's' : ''} found — select to import`}
                  {step === 'importing' && 'Importing selected projects…'}
                  {step === 'done' && 'Import complete'}
                </p>
              </div>
            </div>
            {!importing && (
              <DialogPrimitive.Close asChild>
                <button
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--t-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = 'var(--t-text-secondary)')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = 'var(--t-text-muted)')
                  }
                >
                  <X size={15} />
                </button>
              </DialogPrimitive.Close>
            )}
          </div>

          {/* ── Body ── */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Step 1 — Credentials */}
            {step === 'credentials' && (
              <div style={{ padding: '20px 24px' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>API Base URL</label>
                  <input
                    style={inputStyle}
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 5 }}>
                    EU region:{' '}
                    <code style={{ fontFamily: 'monospace' }}>
                      eu-test-manager-api.lambdatest.com/api/v1
                    </code>
                  </p>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>
                    Username <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
                  </label>
                  <input
                    style={inputStyle}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your-lambdatest-username"
                    autoFocus
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Access Key <span style={{ color: 'var(--t-accent-danger, #e5484d)' }}>*</span>
                  </label>
                  <input
                    style={inputStyle}
                    type="password"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    placeholder="••••••••••••••••"
                    autoComplete="current-password"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSearch()
                    }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 5 }}>
                    LambdaTest → Profile → API Key
                  </p>
                </div>
                {searchError && (
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--t-accent-danger, #e5484d)',
                      marginTop: 14,
                    }}
                  >
                    {searchError}
                  </p>
                )}
              </div>
            )}

            {/* Step 2 — Project list */}
            {step === 'projects' && (
              <div>
                {projects.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 24px',
                      borderBottom: '1px solid var(--t-border-subtle)',
                      cursor: 'pointer',
                    }}
                    onClick={toggleAll}
                  >
                    <span
                      style={{
                        color: allSelected ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
                        display: 'flex',
                      }}
                    >
                      {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t-text-muted)' }}>
                      {allSelected ? 'Deselect all' : 'Select all'}
                    </span>
                    {selected.size > 0 && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: 11,
                          color: 'var(--t-text-muted)',
                          background: 'var(--t-bg-surface)',
                          padding: '2px 8px',
                          borderRadius: 99,
                        }}
                      >
                        {selected.size} selected
                      </span>
                    )}
                  </div>
                )}
                {projects.length === 0 ? (
                  <div
                    style={{
                      padding: '48px 24px',
                      textAlign: 'center',
                      color: 'var(--t-text-muted)',
                      fontSize: 13,
                    }}
                  >
                    No projects found in this workspace.
                  </div>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {projects.map((p, i) => {
                      const pid = String(p.project_id)
                      const isSelected = selected.has(pid)
                      return (
                        <li
                          key={pid}
                          onClick={() => toggleProject(pid)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 24px',
                            borderTop: i > 0 ? '1px solid var(--t-border-subtle)' : 'none',
                            cursor: 'pointer',
                            background: isSelected ? 'var(--t-bg-hover)' : 'transparent',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected)
                              (e.currentTarget as HTMLElement).style.background =
                                'var(--t-bg-hover)'
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected)
                              (e.currentTarget as HTMLElement).style.background = 'transparent'
                          }}
                        >
                          <span
                            style={{
                              color: isSelected ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
                              display: 'flex',
                              flexShrink: 0,
                            }}
                          >
                            {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                          </span>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 7,
                              background: 'var(--t-bg-surface)',
                              border: '1px solid var(--t-border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Package size={14} color="var(--t-text-muted)" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'var(--t-text-primary)',
                                margin: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {p.name}
                            </p>
                            {p.description && (
                              <p
                                style={{
                                  fontSize: 11,
                                  color: 'var(--t-text-muted)',
                                  margin: '2px 0 0',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {p.description}
                              </p>
                            )}
                          </div>
                          {p.test_case_count !== undefined && (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 99,
                                background: 'var(--t-bg-surface)',
                                color: 'var(--t-text-muted)',
                                fontWeight: 500,
                                flexShrink: 0,
                              }}
                            >
                              {p.test_case_count} tests
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Step 3 — Import progress */}
            {(step === 'importing' || step === 'done') && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {progress.map((p, i) => (
                  <li
                    key={p.projectId}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '14px 24px',
                      borderTop: i > 0 ? '1px solid var(--t-border-subtle)' : 'none',
                    }}
                  >
                    <span style={{ marginTop: 2, flexShrink: 0 }}>
                      {p.status === 'pending' && (
                        <Square size={15} color="var(--t-border-default)" />
                      )}
                      {p.status === 'running' && (
                        <CircleNotch
                          size={15}
                          color="var(--t-text-muted)"
                          style={{ animation: 'spin 1s linear infinite' }}
                        />
                      )}
                      {p.status === 'done' && (
                        <CheckCircle
                          size={15}
                          color="var(--t-accent-success, #1a9e5e)"
                          weight="fill"
                        />
                      )}
                      {p.status === 'error' && (
                        <Warning size={15} color="var(--t-accent-danger, #e5484d)" weight="fill" />
                      )}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--t-text-primary)',
                          margin: 0,
                        }}
                      >
                        {p.name}
                      </p>
                      {(p.foldersCreated > 0 || p.testsCreated > 0) && (
                        <p
                          style={{
                            fontSize: 12,
                            color: 'var(--t-text-secondary)',
                            margin: '4px 0 0',
                            display: 'flex',
                            gap: 12,
                          }}
                        >
                          <span>
                            {p.foldersCreated} folder{p.foldersCreated !== 1 ? 's' : ''}
                          </span>
                          <span>
                            {p.testsCreated} test{p.testsCreated !== 1 ? 's' : ''}
                          </span>
                        </p>
                      )}
                      {p.status !== 'done' && !p.error && (
                        <p
                          style={{
                            fontSize: 11,
                            color: 'var(--t-text-muted)',
                            margin: '3px 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.activity}
                        </p>
                      )}
                      {p.error && (
                        <p
                          style={{
                            fontSize: 11,
                            color: 'var(--t-accent-danger, #e5484d)',
                            margin: '3px 0 0',
                          }}
                        >
                          {p.error}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Footer ── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              padding: '14px 24px',
              borderTop: '1px solid var(--t-border-subtle)',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
              {step === 'projects' && selected.size > 0 && (
                <span>
                  {selected.size} project{selected.size !== 1 ? 's' : ''} selected → imported as
                  spaces
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {step !== 'importing' && (
                <Button variant="outline" size="sm" onClick={onClose}>
                  {step === 'done' ? 'Close' : 'Cancel'}
                </Button>
              )}
              {step === 'credentials' && (
                <Button
                  size="sm"
                  onClick={() => void handleSearch()}
                  disabled={searching || !username.trim() || !accessKey.trim()}
                  style={{ gap: 6 }}
                >
                  {searching ? (
                    'Fetching…'
                  ) : (
                    <>
                      <MagnifyingGlass size={13} /> Search Projects
                    </>
                  )}
                </Button>
              )}
              {step === 'projects' && (
                <Button
                  size="sm"
                  onClick={() => void handleImport()}
                  disabled={selected.size === 0 || !appId}
                  style={{ gap: 6 }}
                >
                  <UploadSimple size={13} />
                  Import{' '}
                  {selected.size > 0
                    ? `${selected.size} Project${selected.size !== 1 ? 's' : ''}`
                    : ''}
                </Button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </DialogPrimitive.Root>
  )
}
