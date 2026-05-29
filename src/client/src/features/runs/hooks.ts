import { useEffect, useState, useCallback, useRef } from 'react'
import type { TestRun, RunResult, RunReport, CreateRunPayload } from '../../types/index.js'
import { api } from '../../lib/api.js'

// ─── Module-level SWR cache ───────────────────────────────────────────────────
const runsCache = new Map<number, TestRun[]>()

export function useRuns(appId: number | null) {
  const seed = appId !== null ? (runsCache.get(appId) ?? null) : null
  const [runs, setRuns] = useState<TestRun[]>(seed ?? [])
  const [loading, setLoading] = useState(seed === null && appId !== null)
  const [error, setError] = useState<string | null>(null)

  const prevAppRef = useRef<number | null>(null)
  if (prevAppRef.current !== appId) {
    prevAppRef.current = appId
    const next = appId !== null ? (runsCache.get(appId) ?? null) : null
    setRuns(next ?? [])
    setLoading(next === null && appId !== null)
    setError(null)
  }

  const fetch = useCallback(async () => {
    if (appId === null) return
    if (!runsCache.has(appId)) setLoading(true)
    try {
      setError(null)
      const data = await api.runs.list(appId)
      runsCache.set(appId, data)
      setRuns(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch runs')
    } finally {
      setLoading(false)
    }
  }, [appId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const createRun = async (data: CreateRunPayload) => {
    if (appId === null) return
    const created = await api.runs.create(appId, data)
    setRuns((prev) => {
      const next = [...prev, created]
      runsCache.set(appId, next)
      return next
    })
    return created
  }

  const removeRun = async (runId: number) => {
    if (appId === null) return
    await api.runs.delete(appId, runId)
    setRuns((prev) => {
      const next = prev.filter((r) => r.id !== runId)
      runsCache.set(appId, next)
      return next
    })
  }

  const refetch = useCallback(async () => {
    if (appId !== null) runsCache.delete(appId)
    await fetch()
  }, [appId, fetch])

  return { runs, loading, error, createRun, removeRun, refetch }
}

// ─── Module-level SWR cache for run execution ────────────────────────────────
// Keyed by "appId:runId". Results change frequently (marks/steps) but still
// worth caching so navigating away and back shows data immediately.
const runResultsCache = new Map<string, RunResult[]>()
const runReportCache = new Map<string, RunReport>()

export function useRunExecution(appId: number | null, runId: number | null) {
  const cacheKey = appId !== null && runId !== null ? `${appId}:${runId}` : null

  const seedResults = cacheKey ? (runResultsCache.get(cacheKey) ?? null) : null
  const seedReport = cacheKey ? (runReportCache.get(cacheKey) ?? null) : null

  const [results, setResults] = useState<RunResult[]>(seedResults ?? [])
  const [report, setReport] = useState<RunReport | null>(seedReport ?? null)
  const [loading, setLoading] = useState(seedResults === null && cacheKey !== null)

  const prevKeyRef = useRef<string | null>(null)
  if (prevKeyRef.current !== cacheKey) {
    prevKeyRef.current = cacheKey
    const nextResults = cacheKey ? (runResultsCache.get(cacheKey) ?? null) : null
    const nextReport = cacheKey ? (runReportCache.get(cacheKey) ?? null) : null
    setResults(nextResults ?? [])
    setReport(nextReport ?? null)
    setLoading(nextResults === null && cacheKey !== null)
  }

  const fetchResults = useCallback(async () => {
    if (appId === null || runId === null || !cacheKey) return
    if (!runResultsCache.has(cacheKey)) setLoading(true)
    try {
      const [r, rep] = await Promise.all([
        api.runs.results(appId, runId),
        api.runs.report(appId, runId),
      ])
      runResultsCache.set(cacheKey, r)
      if (rep) runReportCache.set(cacheKey, rep)
      setResults(r)
      setReport(rep)
    } finally {
      setLoading(false)
    }
  }, [appId, runId, cacheKey])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  const markResult = async (
    resultId: number,
    status: 'pass' | 'fail' | 'skip' | 'blocked',
    opts?: { notes?: string; executedBy?: string; propagateToSteps?: boolean }
  ) => {
    if (appId === null || runId === null) return
    await api.runs.markResult(appId, runId, resultId, { status, ...opts })
    await fetchResults()
  }

  const markStep = async (
    resultId: number,
    stepResultId: number,
    status: 'pass' | 'fail' | 'skip'
  ) => {
    if (appId === null || runId === null) return
    await api.runs.markStep(appId, runId, resultId, stepResultId, { status })
    await fetchResults()
  }

  return { results, report, loading, markResult, markStep, refetch: fetchResults }
}

export function invalidateRunsCache(appId: number) {
  runsCache.delete(appId)
}

export function getRunsCacheSize() {
  return runsCache.size
}

export function clearAllRunsCache() {
  runsCache.clear()
}

export function getRunResultsCacheSize() {
  return runResultsCache.size
}

export function clearAllRunResultsCache() {
  runResultsCache.clear()
  runReportCache.clear()
}
