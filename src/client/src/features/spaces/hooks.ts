import { useEffect, useState, useCallback, useRef } from 'react'
import type { Space, CreateSpacePayload } from '../../types/index.js'
import { api } from '../../lib/api.js'

// ─── Module-level SWR cache ───────────────────────────────────────────────────
const spacesCache = new Map<number, Space[]>()

export function useSpaces(appId: number | null) {
  const seed = appId !== null ? (spacesCache.get(appId) ?? null) : null
  const [spaces, setSpaces] = useState<Space[]>(seed ?? [])
  const [loading, setLoading] = useState(seed === null && appId !== null)
  const [error, setError] = useState<string | null>(null)

  const prevAppRef = useRef<number | null>(null)
  if (prevAppRef.current !== appId) {
    prevAppRef.current = appId
    const next = appId !== null ? (spacesCache.get(appId) ?? null) : null
    setSpaces(next ?? [])
    setLoading(next === null && appId !== null)
    setError(null)
  }

  const fetch = useCallback(async () => {
    if (appId === null) return
    if (!spacesCache.has(appId)) setLoading(true)
    try {
      setError(null)
      const data = await api.spaces.list(appId)
      spacesCache.set(appId, data)
      setSpaces(data)
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
    setSpaces((prev) => {
      const next = [...prev, created]
      spacesCache.set(appId, next)
      return next
    })
    return created
  }

  const removeSpace = async (spaceId: number) => {
    if (appId === null) return
    await api.spaces.delete(appId, spaceId)
    setSpaces((prev) => {
      const next = prev.filter((s) => s.id !== spaceId)
      spacesCache.set(appId, next)
      return next
    })
  }

  const refetch = useCallback(async () => {
    if (appId !== null) spacesCache.delete(appId)
    await fetch()
  }, [appId, fetch])

  return { spaces, loading, error, addSpace, removeSpace, refetch }
}

export function invalidateSpacesCache(appId: number) {
  spacesCache.delete(appId)
}

export function getSpacesCacheSize() {
  return spacesCache.size
}

export function clearAllSpacesCache() {
  spacesCache.clear()
}
