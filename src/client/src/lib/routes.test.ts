import { describe, it, expect } from 'vitest'
import { parseUrl, viewToUrl } from './routes.js'
import type { View } from '../types/index.js'

describe('viewToUrl', () => {
  it('apps → /', () => {
    expect(viewToUrl({ type: 'apps' })).toBe('/')
  })

  it('spaces → /apps/:id', () => {
    expect(viewToUrl({ type: 'spaces', appId: 3 })).toBe('/apps/3')
  })

  it('tests (no folder) → /apps/:id/spaces/:sid', () => {
    expect(viewToUrl({ type: 'tests', appId: 1, spaceId: 2 })).toBe('/apps/1/spaces/2')
  })

  it('tests (with folder, no selection) → /apps/:id/spaces/:sid/folders/:fid', () => {
    expect(viewToUrl({ type: 'tests', appId: 1, spaceId: 2, folderId: 5 })).toBe(
      '/apps/1/spaces/2/folders/5'
    )
  })

  it('tests (with folder and selected test) → .../tests/:tid', () => {
    expect(
      viewToUrl({ type: 'tests', appId: 1, spaceId: 2, folderId: 5, selectedTestId: 99 })
    ).toBe('/apps/1/spaces/2/folders/5/tests/99')
  })

  it('test-editor (new) → .../tests/new', () => {
    expect(viewToUrl({ type: 'test-editor', appId: 1, spaceId: 2, folderId: 5 })).toBe(
      '/apps/1/spaces/2/folders/5/tests/new'
    )
  })

  it('test-editor (existing) → .../tests/:tid/edit', () => {
    expect(viewToUrl({ type: 'test-editor', appId: 1, spaceId: 2, folderId: 5, testId: 7 })).toBe(
      '/apps/1/spaces/2/folders/5/tests/7/edit'
    )
  })

  it('runs → /apps/:id/runs', () => {
    expect(viewToUrl({ type: 'runs', appId: 4 })).toBe('/apps/4/runs')
  })

  it('run-execution → /apps/:id/runs/:rid', () => {
    expect(viewToUrl({ type: 'run-execution', appId: 4, runId: 8 })).toBe('/apps/4/runs/8')
  })

  it('settings → /apps/:id/settings', () => {
    expect(viewToUrl({ type: 'settings', appId: 2 })).toBe('/apps/2/settings')
  })
})

describe('parseUrl', () => {
  it('/ → apps', () => {
    expect(parseUrl('/')).toEqual({ type: 'apps' })
  })

  it('unknown path → apps', () => {
    expect(parseUrl('/unknown/path')).toEqual({ type: 'apps' })
  })

  it('trailing slash treated same as root', () => {
    expect(parseUrl('')).toEqual({ type: 'apps' })
  })

  it('/apps/:id → spaces', () => {
    expect(parseUrl('/apps/3')).toEqual({ type: 'spaces', appId: 3 })
  })

  it('/apps/:id/spaces/:sid → tests (no folder)', () => {
    expect(parseUrl('/apps/1/spaces/2')).toEqual({ type: 'tests', appId: 1, spaceId: 2 })
  })

  it('/apps/:id/spaces/:sid/folders/:fid → tests (with folder)', () => {
    expect(parseUrl('/apps/1/spaces/2/folders/5')).toEqual({
      type: 'tests',
      appId: 1,
      spaceId: 2,
      folderId: 5,
    })
  })

  it('.../folders/:fid/tests/:tid → tests with selectedTestId', () => {
    expect(parseUrl('/apps/1/spaces/2/folders/5/tests/99')).toEqual({
      type: 'tests',
      appId: 1,
      spaceId: 2,
      folderId: 5,
      selectedTestId: 99,
    })
  })

  it('.../tests/new → test-editor (new)', () => {
    expect(parseUrl('/apps/1/spaces/2/folders/5/tests/new')).toEqual({
      type: 'test-editor',
      appId: 1,
      spaceId: 2,
      folderId: 5,
    })
  })

  it('.../tests/:tid/edit → test-editor (existing)', () => {
    expect(parseUrl('/apps/1/spaces/2/folders/5/tests/7/edit')).toEqual({
      type: 'test-editor',
      appId: 1,
      spaceId: 2,
      folderId: 5,
      testId: 7,
    })
  })

  it('/apps/:id/runs → runs', () => {
    expect(parseUrl('/apps/4/runs')).toEqual({ type: 'runs', appId: 4 })
  })

  it('/apps/:id/runs/:rid → run-execution', () => {
    expect(parseUrl('/apps/4/runs/8')).toEqual({ type: 'run-execution', appId: 4, runId: 8 })
  })

  it('/apps/:id/settings → settings', () => {
    expect(parseUrl('/apps/2/settings')).toEqual({ type: 'settings', appId: 2 })
  })
})

describe('round-trip (parseUrl → viewToUrl → parseUrl)', () => {
  const views: View[] = [
    { type: 'apps' },
    { type: 'spaces', appId: 1 },
    { type: 'tests', appId: 1, spaceId: 2 },
    { type: 'tests', appId: 1, spaceId: 2, folderId: 3 },
    { type: 'tests', appId: 1, spaceId: 2, folderId: 3, selectedTestId: 10 },
    { type: 'test-editor', appId: 1, spaceId: 2, folderId: 3 },
    { type: 'test-editor', appId: 1, spaceId: 2, folderId: 3, testId: 7 },
    { type: 'runs', appId: 1 },
    { type: 'run-execution', appId: 1, runId: 5 },
    { type: 'settings', appId: 1 },
  ]

  for (const view of views) {
    it(`${view.type} survives round-trip`, () => {
      expect(parseUrl(viewToUrl(view))).toEqual(view)
    })
  }
})
