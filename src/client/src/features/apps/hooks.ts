import { useEffect, useState, useCallback } from 'react'
import type { App, CreateAppPayload, UpdateAppPayload } from '../../types/index.js'
import { api } from '../../lib/api.js'

// ─── Module-level SWR cache ───────────────────────────────────────────────────
// Apps are global (no key needed) — cache the last fetched list.
let appsCache: App[] | null = null

export function getAppsCacheSize() {
  return appsCache !== null ? appsCache.length : 0
}

export function clearAppsCache() {
  appsCache = null
}

export function useApps() {
  const [apps, setApps] = useState<App[]>(appsCache ?? [])
  // Show skeleton only on the very first load (no cached list yet)
  const [loading, setLoading] = useState(appsCache === null)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (appsCache === null) setLoading(true)
    try {
      setError(null)
      const data = await api.apps.list()
      appsCache = data
      setApps(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch apps')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const addApp = async (data: CreateAppPayload) => {
    const created = await api.apps.create(data)
    setApps((prev) => {
      const next = [...prev, created]
      appsCache = next
      return next
    })
    return created
  }

  const updateApp = async (id: number, data: UpdateAppPayload) => {
    const updated = await api.apps.update(id, data)
    setApps((prev) => {
      const next = prev.map((a) => (a.id === id ? updated : a))
      appsCache = next
      return next
    })
    return updated
  }

  const removeApp = async (id: number) => {
    await api.apps.delete(id)
    setApps((prev) => {
      const next = prev.filter((a) => a.id !== id)
      appsCache = next
      return next
    })
  }

  const refetch = useCallback(async () => {
    appsCache = null
    await fetch()
  }, [fetch])

  return { apps, loading, error, addApp, updateApp, removeApp, refetch }
}
