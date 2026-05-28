import { useEffect, useState, useCallback } from 'react'
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

export function useFolders(spaceId: number | null) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (spaceId === null) return
    setLoading(true)
    try {
      setError(null)
      setFolders(await api.folders.list(spaceId))
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
    setFolders((prev) => [...prev, created])
    return created
  }

  const removeFolder = async (folderId: number) => {
    if (spaceId === null) return
    await api.folders.delete(spaceId, folderId)
    setFolders((prev) => prev.filter((f) => f.id !== folderId))
  }

  return {
    folders,
    tree: buildTree(folders),
    loading,
    error,
    addFolder,
    removeFolder,
    refetch: fetch,
  }
}
