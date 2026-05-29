import { useEffect, useState, useCallback, useRef } from 'react'
import type { Test, TestDetail, CreateTestPayload } from '../../types/index.js'
import { api } from '../../lib/api.js'

// ─── Module-level SWR caches ─────────────────────────────────────────────────
// Keyed by folderId / "folderId:testId". Values survive component unmount so
// navigating back to a previously-visited folder/test shows data immediately
// (no skeleton) while a background refresh silently updates the state.

const testsCache = new Map<number, Test[]>()
const detailCache = new Map<string, TestDetail>()

export function useTests(folderId: number | null) {
  const seed = folderId !== null ? (testsCache.get(folderId) ?? null) : null
  const [tests, setTests] = useState<Test[]>(seed ?? [])
  // Only show the skeleton on the very first visit (no cached data yet)
  const [loading, setLoading] = useState(seed === null && folderId !== null)
  const [error, setError] = useState<string | null>(null)

  // Track the folderId that was last used to seed state so we can re-seed
  // synchronously when folderId changes (before the effect fires).
  const prevFolderRef = useRef<number | null>(null)
  if (prevFolderRef.current !== folderId) {
    prevFolderRef.current = folderId
    const next = folderId !== null ? (testsCache.get(folderId) ?? null) : null
    // Synchronously reset state so the UI doesn't flash stale data from the
    // previous folder while the new folder's data is loading.
    setTests(next ?? [])
    setLoading(next === null && folderId !== null)
    setError(null)
  }

  const fetch = useCallback(async () => {
    if (folderId === null) return
    // Only show spinner when we have no cached data to display
    if (!testsCache.has(folderId)) setLoading(true)
    try {
      setError(null)
      const data = await api.tests.list(folderId)
      testsCache.set(folderId, data)
      setTests(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch tests')
    } finally {
      setLoading(false)
    }
  }, [folderId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const addTest = async (data: CreateTestPayload) => {
    if (folderId === null) return
    const created = await api.tests.create(folderId, data)
    setTests((prev) => {
      const next = [...prev, created]
      testsCache.set(folderId, next)
      return next
    })
    return created
  }

  const removeTest = async (testId: number) => {
    if (folderId === null) return
    await api.tests.delete(folderId, testId)
    setTests((prev) => {
      const next = prev.filter((t) => t.id !== testId)
      testsCache.set(folderId, next)
      return next
    })
  }

  /** Force-invalidate cache for this folder then refetch (call after mutations). */
  const refetch = useCallback(async () => {
    if (folderId !== null) testsCache.delete(folderId)
    await fetch()
  }, [folderId, fetch])

  return { tests, loading, error, addTest, removeTest, refetch }
}

export function useTestDetail(folderId: number | null, testId: number | null) {
  const cacheKey = folderId !== null && testId !== null ? `${folderId}:${testId}` : null
  const seed = cacheKey ? (detailCache.get(cacheKey) ?? null) : null
  const [test, setTest] = useState<TestDetail | null>(seed)
  const [loading, setLoading] = useState(seed === null && cacheKey !== null)

  const prevKeyRef = useRef<string | null>(null)
  if (prevKeyRef.current !== cacheKey) {
    prevKeyRef.current = cacheKey
    const next = cacheKey ? (detailCache.get(cacheKey) ?? null) : null
    setTest(next)
    setLoading(next === null && cacheKey !== null)
  }

  const fetch = useCallback(async () => {
    if (folderId === null || testId === null || !cacheKey) return
    if (!detailCache.has(cacheKey)) setLoading(true)
    try {
      const data = await api.tests.get(folderId, testId)
      detailCache.set(cacheKey, data)
      setTest(data)
    } finally {
      setLoading(false)
    }
  }, [folderId, testId, cacheKey])

  useEffect(() => {
    fetch()
  }, [fetch])

  const refetch = useCallback(async () => {
    if (cacheKey) detailCache.delete(cacheKey)
    await fetch()
  }, [cacheKey, fetch])

  return { test, loading, refetch }
}

/** Evict all cached data for a folder (call after mutations that change counts). */
export function invalidateTestsCache(folderId: number) {
  testsCache.delete(folderId)
}

/** Evict a single test detail from cache. */
export function invalidateTestDetailCache(folderId: number, testId: number) {
  detailCache.delete(`${folderId}:${testId}`)
}

export function getTestsCacheSize() {
  return testsCache.size
}

export function getTestDetailCacheSize() {
  return detailCache.size
}

export function clearAllTestsCache() {
  testsCache.clear()
}

export function clearAllTestDetailsCache() {
  detailCache.clear()
}

/** Read test list for a folder from the shared module-level cache. */
export function getTestsFromCache(folderId: number): Test[] | undefined {
  return testsCache.get(folderId)
}

/** Write a test list into the shared module-level cache. */
export function setTestsInCache(folderId: number, data: Test[]): void {
  testsCache.set(folderId, data)
}

/** Read a test detail from the shared module-level detail cache. */
export function getTestDetailFromCache(folderId: number, testId: number): TestDetail | undefined {
  return detailCache.get(`${folderId}:${testId}`)
}

/** Write a test detail into the shared module-level detail cache. */
export function setTestDetailInCache(folderId: number, testId: number, data: TestDetail): void {
  detailCache.set(`${folderId}:${testId}`, data)
}
