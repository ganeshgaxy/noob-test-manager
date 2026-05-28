import { useEffect, useState, useCallback } from 'react'
import type { App, CreateAppPayload, UpdateAppPayload } from '../../types/index.js'
import { api } from '../../lib/api.js'

export function useApps() {
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    try {
      setError(null)
      setApps(await api.apps.list())
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
    setApps((prev) => [...prev, created])
    return created
  }

  const updateApp = async (id: number, data: UpdateAppPayload) => {
    const updated = await api.apps.update(id, data)
    setApps((prev) => prev.map((a) => (a.id === id ? updated : a)))
    return updated
  }

  const removeApp = async (id: number) => {
    await api.apps.delete(id)
    setApps((prev) => prev.filter((a) => a.id !== id))
  }

  return { apps, loading, error, addApp, updateApp, removeApp, refetch: fetch }
}
