import { useEffect, useState, useCallback } from 'react'
import type { Test, TestDetail, CreateTestPayload } from '../../types/index.js'
import { api } from '../../lib/api.js'

export function useTests(folderId: number | null) {
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (folderId === null) return
    setLoading(true)
    try {
      setError(null)
      setTests(await api.tests.list(folderId))
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
    setTests((prev) => [...prev, created])
    return created
  }

  const removeTest = async (testId: number) => {
    if (folderId === null) return
    await api.tests.delete(folderId, testId)
    setTests((prev) => prev.filter((t) => t.id !== testId))
  }

  return { tests, loading, error, addTest, removeTest, refetch: fetch }
}

export function useTestDetail(folderId: number | null, testId: number | null) {
  const [test, setTest] = useState<TestDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (folderId === null || testId === null) return
    setLoading(true)
    try {
      setTest(await api.tests.get(folderId, testId))
    } finally {
      setLoading(false)
    }
  }, [folderId, testId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { test, loading, refetch: fetch }
}
