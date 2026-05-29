import { useEffect, useState, useCallback, useRef } from 'react'
import type { Folder, FolderNode, CreateFolderPayload } from '../../types/index.js'
import { api } from '../../lib/api.js'

function buildTree(flat: Folder[]): FolderNode[] {
  const map = new Map<number, FolderNode>()
  flat.forEach((f) => map.set(f.id, { ...f, children: [] }))
  const roots: FolderNode[] = []
  flat.forEach((f) => {
    const node = map.get(f.id)!
    if (f.parentFolderId === null) {
      roots.push(node)
    } else {
      map.get(f.parentFolderId)?.children.push(node)
    }
  })
  return roots
}

// ─── Module-level SWR cache ───────────────────────────────────────────────────
const foldersCache = new Map<number, Folder[]>()

export function useFolders(spaceId: number | null) {
  const seed = spaceId !== null ? (foldersCache.get(spaceId) ?? null) : null
  const [folders, setFolders] = useState<Folder[]>(seed ?? [])
  const [loading, setLoading] = useState(seed === null && spaceId !== null)
  const [error, setError] = useState<string | null>(null)

  const prevSpaceRef = useRef<number | null>(null)
  if (prevSpaceRef.current !== spaceId) {
    prevSpaceRef.current = spaceId
    const next = spaceId !== null ? (foldersCache.get(spaceId) ?? null) : null
    setFolders(next ?? [])
    setLoading(next === null && spaceId !== null)
    setError(null)
  }

  const fetch = useCallback(async () => {
    if (spaceId === null) return
    if (!foldersCache.has(spaceId)) setLoading(true)
    try {
      setError(null)
      const data = await api.folders.list(spaceId)
      foldersCache.set(spaceId, data)
      setFolders(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch folders')
    } finally {
      setLoading(false)
    }
  }, [spaceId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const addFolder = async (data: CreateFolderPayload) => {
    if (spaceId === null) return
    const created = await api.folders.create(spaceId, data)
    setFolders((prev) => {
      const next = [...prev, created]
      foldersCache.set(spaceId, next)
      return next
    })
    return created
  }

  const removeFolder = async (folderId: number) => {
    if (spaceId === null) return
    await api.folders.delete(spaceId, folderId)
    setFolders((prev) => {
      const next = prev.filter((f) => f.id !== folderId)
      foldersCache.set(spaceId, next)
      return next
    })
  }

  const refetch = useCallback(async () => {
    if (spaceId !== null) foldersCache.delete(spaceId)
    await fetch()
  }, [spaceId, fetch])

  return {
    folders,
    tree: buildTree(folders),
    loading,
    error,
    addFolder,
    removeFolder,
    refetch,
  }
}

export function invalidateFoldersCache(spaceId: number) {
  foldersCache.delete(spaceId)
}

export function getFoldersCacheSize() {
  return foldersCache.size
}

export function clearAllFoldersCache() {
  foldersCache.clear()
}

/** Read flat folder list for a space from the shared module-level cache. */
export function getFoldersFromCache(spaceId: number): Folder[] | undefined {
  return foldersCache.get(spaceId)
}

/** Write a flat folder list into the shared module-level cache. */
export function setFoldersInCache(spaceId: number, data: Folder[]): void {
  foldersCache.set(spaceId, data)
}
