import type { View } from '../types/index.js'

export function viewToUrl(view: View): string {
  switch (view.type) {
    case 'apps':
      return '/'
    case 'spaces':
      return `/apps/${view.appId}`
    case 'tests':
      if (view.folderId == null) return `/apps/${view.appId}/spaces/${view.spaceId}`
      if (view.selectedTestId != null)
        return `/apps/${view.appId}/spaces/${view.spaceId}/folders/${view.folderId}/tests/${view.selectedTestId}`
      return `/apps/${view.appId}/spaces/${view.spaceId}/folders/${view.folderId}`
    case 'test-editor':
      if (view.testId != null)
        return `/apps/${view.appId}/spaces/${view.spaceId}/folders/${view.folderId}/tests/${view.testId}/edit`
      return `/apps/${view.appId}/spaces/${view.spaceId}/folders/${view.folderId}/tests/new`
    case 'runs':
      return `/apps/${view.appId}/runs`
    case 'run-execution':
      return `/apps/${view.appId}/runs/${view.runId}`
    case 'settings':
      return `/apps/${view.appId}/settings`
    case 'trash':
      return `/apps/${view.appId}/spaces/${view.spaceId}/trash`
    case 'users':
      return '/users'
    case 'admin-settings':
      return '/admin-settings'
  }
}

export function parseUrl(pathname: string): View {
  const p = pathname.replace(/\/$/, '') || '/'

  // /apps/:appId/spaces/:spaceId/folders/:folderId/tests/new
  let m = p.match(/^\/apps\/(\d+)\/spaces\/(\d+)\/folders\/(\d+)\/tests\/new$/)
  if (m) return { type: 'test-editor', appId: +m[1], spaceId: +m[2], folderId: +m[3] }

  // /apps/:appId/spaces/:spaceId/folders/:folderId/tests/:testId/edit
  m = p.match(/^\/apps\/(\d+)\/spaces\/(\d+)\/folders\/(\d+)\/tests\/(\d+)\/edit$/)
  if (m)
    return { type: 'test-editor', appId: +m[1], spaceId: +m[2], folderId: +m[3], testId: +m[4] }

  // /apps/:appId/spaces/:spaceId/folders/:folderId/tests/:testId  (detail panel)
  m = p.match(/^\/apps\/(\d+)\/spaces\/(\d+)\/folders\/(\d+)\/tests\/(\d+)$/)
  if (m)
    return { type: 'tests', appId: +m[1], spaceId: +m[2], folderId: +m[3], selectedTestId: +m[4] }

  // /apps/:appId/spaces/:spaceId/folders/:folderId
  m = p.match(/^\/apps\/(\d+)\/spaces\/(\d+)\/folders\/(\d+)$/)
  if (m) return { type: 'tests', appId: +m[1], spaceId: +m[2], folderId: +m[3] }

  // /apps/:appId/spaces/:spaceId
  m = p.match(/^\/apps\/(\d+)\/spaces\/(\d+)$/)
  if (m) return { type: 'tests', appId: +m[1], spaceId: +m[2] }

  // /apps/:appId/runs/:runId
  m = p.match(/^\/apps\/(\d+)\/runs\/(\d+)$/)
  if (m) return { type: 'run-execution', appId: +m[1], runId: +m[2] }

  // /apps/:appId/runs
  m = p.match(/^\/apps\/(\d+)\/runs$/)
  if (m) return { type: 'runs', appId: +m[1] }

  // /apps/:appId/spaces/:spaceId/trash
  m = p.match(/^\/apps\/(\d+)\/spaces\/(\d+)\/trash$/)
  if (m) return { type: 'trash', appId: +m[1], spaceId: +m[2] }

  // /apps/:appId/settings
  m = p.match(/^\/apps\/(\d+)\/settings$/)
  if (m) return { type: 'settings', appId: +m[1] }

  // /apps/:appId
  m = p.match(/^\/apps\/(\d+)$/)
  if (m) return { type: 'spaces', appId: +m[1] }

  // /users
  if (p === '/users') return { type: 'users' }

  // /admin-settings
  if (p === '/admin-settings') return { type: 'admin-settings' }

  return { type: 'apps' }
}
