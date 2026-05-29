import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash, X, PencilSimple, Users } from '@phosphor-icons/react'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { api } from '../../lib/api.js'
import type { Group, GroupMember } from '../../types/index.js'
import { SkeletonSidebarItem, SkeletonRows } from '../ui/skeleton.js'

// ─── UserGroupsView ───────────────────────────────────────────────────────────

export function UserGroupsView() {
  // ── Group list state ──────────────────────────────────────────────────────
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Create group state ────────────────────────────────────────────────────
  const [createMode, setCreateMode] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  // ── Edit group state ──────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // ── Members state ─────────────────────────────────────────────────────────
  const [members, setMembers] = useState<GroupMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<
    { id: number; email: string; name: string | null }[]
  >([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load groups ───────────────────────────────────────────────────────────
  const loadGroups = useCallback(async () => {
    setGroupsLoading(true)
    try {
      setGroups(await api.groups.list())
    } catch {
      /* ignore */
    } finally {
      setGroupsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  // ── Select group → load members ───────────────────────────────────────────
  const selectGroup = async (g: Group) => {
    setSelectedGroup(g)
    setEditMode(false)
    setSearchQ('')
    setSearchResults([])
    setMembersLoading(true)
    try {
      setMembers(await api.groups.members.list(g.id))
    } catch {
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newName.trim()) return
    setError(null)
    try {
      await api.groups.create({ name: newName.trim(), description: newDesc.trim() || undefined })
      setNewName('')
      setNewDesc('')
      setCreateMode(false)
      await loadGroups()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!selectedGroup || !editName.trim()) return
    setError(null)
    try {
      const updated = await api.groups.update(selectedGroup.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      })
      setSelectedGroup(updated)
      setGroups((gs) => gs.map((g) => (g.id === updated.id ? updated : g)))
      setEditMode(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // ── Delete group ──────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    try {
      await api.groups.delete(id)
      if (selectedGroup?.id === id) setSelectedGroup(null)
      await loadGroups()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // ── Member search ─────────────────────────────────────────────────────────
  const handleSearch = (q: string) => {
    setSearchQ(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    searchTimer.current = setTimeout(async () => {
      try {
        setSearchResults(await api.users.search(q))
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }

  // ── Add member ────────────────────────────────────────────────────────────
  const addMember = async (userId: number) => {
    if (!selectedGroup) return
    try {
      await api.groups.members.add(selectedGroup.id, userId)
      setMembers(await api.groups.members.list(selectedGroup.id))
      setSearchQ('')
      setSearchResults([])
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // ── Remove member ─────────────────────────────────────────────────────────
  const removeMember = async (userId: number) => {
    if (!selectedGroup) return
    try {
      await api.groups.members.remove(selectedGroup.id, userId)
      setMembers((ms) => ms.filter((m) => m.userId !== userId))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const memberIds = new Set(members.map((m) => m.userId))

  return (
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--t-bg-base)',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 28px',
          height: 52,
          borderBottom: '1px solid var(--t-border-subtle)',
          flexShrink: 0,
        }}
      >
        <Users size={15} color="var(--t-text-muted)" />
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)' }}>
          User Groups
        </span>
      </div>

      {error && (
        <div
          style={{
            margin: '8px 24px 0',
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(229,72,77,0.08)',
            border: '1px solid rgba(229,72,77,0.2)',
            fontSize: 13,
            color: 'var(--t-accent-danger)',
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              float: 'right',
              background: 'none',
              border: 'none',
              color: 'var(--t-accent-danger)',
              cursor: 'pointer',
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Split layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── Left: group list ────────────────────────────────────────────── */}
        <div
          style={{
            width: 280,
            borderRight: '1px solid var(--t-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--t-border-subtle)' }}>
            <Button
              size="sm"
              variant="outline"
              style={{ width: '100%', gap: 6 }}
              onClick={() => {
                setCreateMode(true)
                setError(null)
              }}
            >
              <Plus size={14} /> New Group
            </Button>
          </div>

          {createMode && (
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--t-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <Input
                placeholder="Group name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ fontSize: 13 }}
                autoFocus
              />
              <Input
                placeholder="Description (optional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                style={{ fontSize: 12 }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" onClick={() => void handleCreate()} disabled={!newName.trim()}>
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCreateMode(false)
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {groupsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonSidebarItem key={i} i={i} />)
            ) : groups.length === 0 ? (
              <p
                style={{
                  padding: 16,
                  fontSize: 13,
                  color: 'var(--t-text-muted)',
                  margin: 0,
                  fontStyle: 'italic',
                }}
              >
                No groups yet. Create one above.
              </p>
            ) : (
              groups.map((g) => (
                <div
                  key={g.id}
                  onClick={() => void selectGroup(g)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background: selectedGroup?.id === g.id ? 'var(--t-bg-surface)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--t-border-subtle)',
                    borderLeft:
                      selectedGroup?.id === g.id
                        ? '2px solid var(--t-border-strong)'
                        : '2px solid transparent',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-text-primary)' }}>
                      {g.name}
                    </div>
                    {g.description && (
                      <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 2 }}>
                        {g.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDelete(g.id)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--t-text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                      opacity: 0.7,
                    }}
                    title="Delete group"
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t-accent-danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t-text-muted)')}
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right: members panel ─────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedGroup ? (
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <p style={{ fontSize: 13, color: 'var(--t-text-muted)', margin: 0 }}>
                Select a group to manage its members.
              </p>
            </div>
          ) : (
            <>
              {/* Group title + edit */}
              <div
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid var(--t-border-subtle)',
                  flexShrink: 0,
                }}
              >
                {editMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ fontSize: 13 }}
                      autoFocus
                    />
                    <Input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description"
                      style={{ fontSize: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" onClick={() => void handleSaveEdit()}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div
                        style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-text-primary)' }}
                      >
                        {selectedGroup.name}
                      </div>
                      {selectedGroup.description && (
                        <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 3 }}>
                          {selectedGroup.description}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 4 }}>
                        {members.length} member{members.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditMode(true)
                        setEditName(selectedGroup.name)
                        setEditDesc(selectedGroup.description ?? '')
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--t-text-muted)',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                      title="Edit group"
                    >
                      <PencilSimple size={15} />
                    </button>
                  </div>
                )}
              </div>

              {/* Search to add members */}
              <div
                style={{
                  padding: '10px 24px',
                  borderBottom: '1px solid var(--t-border-subtle)',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <Input
                  placeholder="Search users to add…"
                  value={searchQ}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{ fontSize: 13 }}
                />
                {searchResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 24,
                      right: 24,
                      top: '100%',
                      background: 'var(--t-bg-elevated)',
                      border: '1px solid var(--t-border-default)',
                      borderRadius: 6,
                      zIndex: 10,
                      overflow: 'hidden',
                    }}
                  >
                    {searchResults
                      .filter((u) => !memberIds.has(u.id))
                      .map((u) => (
                        <div
                          key={u.id}
                          onClick={() => void addMember(u.id)}
                          style={{
                            padding: '8px 14px',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: 'var(--t-text-secondary)',
                            borderBottom: '1px solid var(--t-border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'var(--t-bg-surface)')
                          }
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Plus size={13} color="var(--t-text-muted)" />
                          <span>{u.name || u.email}</span>
                          {u.name && (
                            <span style={{ color: 'var(--t-text-muted)', fontSize: 11 }}>
                              ({u.email})
                            </span>
                          )}
                          {searchLoading && (
                            <span style={{ color: 'var(--t-text-muted)', fontSize: 11 }}>…</span>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Members list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {membersLoading ? (
                  <SkeletonRows count={4} rowHeight={44} padding="8px 16px" iconSize={24} />
                ) : members.length === 0 ? (
                  <p
                    style={{
                      padding: 24,
                      fontSize: 13,
                      color: 'var(--t-text-muted)',
                      margin: 0,
                      fontStyle: 'italic',
                    }}
                  >
                    No members yet — search above to add.
                  </p>
                ) : (
                  members.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: '11px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        borderBottom: '1px solid var(--t-border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: 'var(--t-bg-elevated)',
                          border: '1px solid var(--t-border-default)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--t-text-primary)',
                        }}
                      >
                        {(m.name ?? m.email).charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ fontSize: 13, color: 'var(--t-text-primary)', fontWeight: 500 }}
                        >
                          {m.name ?? m.email}
                        </div>
                        {m.name && (
                          <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                            {m.email}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => void removeMember(m.userId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--t-text-muted)',
                          cursor: 'pointer',
                          padding: 4,
                        }}
                        title="Remove from group"
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = 'var(--t-accent-danger)')
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t-text-muted)')}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
