import { useEffect, useState, useCallback } from 'react'
import type { TestRun, RunResult, RunReport, CreateRunPayload } from '../../types/index.js'
import { api } from '../../lib/api.js'

export function useRuns(appId: number | null) {
  const [runs, setRuns] = useState<TestRun[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (appId === null) return
    setLoading(true)
    try {
      setError(null)
      setRuns(await api.runs.list(appId))
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
    setRuns((prev) => [...prev, created])
    return created
  }

  const removeRun = async (runId: number) => {
    if (appId === null) return
    await api.runs.delete(appId, runId)
    setRuns((prev) => prev.filter((r) => r.id !== runId))
  }

  return { runs, loading, error, createRun, removeRun, refetch: fetch }
}

export function useRunExecution(appId: number | null, runId: number | null) {
  const [results, setResults] = useState<RunResult[]>([])
  const [report, setReport] = useState<RunReport | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchResults = useCallback(async () => {
    if (appId === null || runId === null) return
    setLoading(true)
    try {
      const [r, rep] = await Promise.all([
        api.runs.results(appId, runId),
        api.runs.report(appId, runId),
      ])
      setResults(r)
      setReport(rep)
    } finally {
      setLoading(false)
    }
  }, [appId, runId])

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
