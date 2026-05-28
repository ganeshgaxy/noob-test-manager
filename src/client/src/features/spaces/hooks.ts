import { useEffect, useState, useCallback } from 'react'
import type { Space, CreateSpacePayload } from '../../types/index.js'
import { api } from '../../lib/api.js'

export function useSpaces(appId: number | null) {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (appId === null) return
    setLoading(true)
    try {
      setError(null)
      setSpaces(await api.spaces.list(appId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch spaces')
    } finally {
      setLoading(false)
    }
  }, [appId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const addSpace = async (data: CreateSpacePayload) => {
    if (appId === null) return
    const created = await api.spaces.create(appId, data)
    setSpaces((prev) => [...prev, created])
    return created
  }

  const removeSpace = async (spaceId: number) => {
    if (appId === null) return
    await api.spaces.delete(appId, spaceId)
    setSpaces((prev) => prev.filter((s) => s.id !== spaceId))
  }

  return { spaces, loading, error, addSpace, removeSpace, refetch: fetch }
}
