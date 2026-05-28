import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'

function makeFoldersRouter() {
  const router = new Hono()
  const store: Record<
    number,
    {
      id: number
      spaceId: number
      name: string
      description: string | null
      parentFolderId: number | null
      order: number
    }
  > = {}
  let nextId = 1

  router.get('/', (c) => {
    const spaceId = Number(c.req.param('spaceId'))
    return c.json(Object.values(store).filter((f) => f.spaceId === spaceId))
  })

  router.post('/', async (c) => {
    const spaceId = Number(c.req.param('spaceId'))
    const body = await c.req.json<{
      name?: string
      description?: string
      parentFolderId?: number
      order?: number
    }>()
    if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
    const folder = {
      id: nextId++,
      spaceId,
      name: body.name.trim(),
      description: body.description ?? null,
      parentFolderId: body.parentFolderId ?? null,
      order: body.order ?? 0,
    }
    store[folder.id] = folder
    return c.json(folder, 201)
  })

  router.get('/:folderId', (c) => {
    const id = Number(c.req.param('folderId'))
    const folder = store[id]
    if (!folder) return c.json({ error: 'not found' }, 404)
    return c.json(folder)
  })

  router.put('/:folderId', async (c) => {
    const id = Number(c.req.param('folderId'))
    if (!store[id]) return c.json({ error: 'not found' }, 404)
    const body = await c.req.json<{ name?: string; description?: string }>()
    store[id] = { ...store[id], ...body }
    return c.json(store[id])
  })

  router.delete('/:folderId', (c) => {
    const id = Number(c.req.param('folderId'))
    if (!store[id]) return c.json({ error: 'not found' }, 404)
    delete store[id]
    return c.json({ success: true })
  })

  return router
}

describe('Folders Routes', () => {
  function makeApp() {
    const app = new Hono()
    app.route('/api/spaces/:spaceId/folders', makeFoldersRouter())
    return app
  }

  it('GET / returns empty list for new space', async () => {
    const res = await makeApp().fetch(new Request('http://localhost/api/spaces/1/folders'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('POST / creates a folder and returns 201', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/spaces/1/folders', {
        method: 'POST',
        body: JSON.stringify({ name: 'Login' }),
      })
    )
    expect(res.status).toBe(201)
    const data = (await res.json()) as { name: string; spaceId: number; parentFolderId: null }
    expect(data.name).toBe('Login')
    expect(data.spaceId).toBe(1)
    expect(data.parentFolderId).toBeNull()
  })

  it('POST / returns 400 when name is missing', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/spaces/1/folders', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    )
    expect(res.status).toBe(400)
    const err = (await res.json()) as { error: string }
    expect(err.error).toContain('name')
  })

  it('POST / supports nested folders via parentFolderId', async () => {
    const app = makeApp()
    const parent = (await (
      await app.fetch(
        new Request('http://localhost/api/spaces/1/folders', {
          method: 'POST',
          body: JSON.stringify({ name: 'Auth' }),
        })
      )
    ).json()) as { id: number }

    const res = await app.fetch(
      new Request('http://localhost/api/spaces/1/folders', {
        method: 'POST',
        body: JSON.stringify({ name: 'Login', parentFolderId: parent.id }),
      })
    )
    const child = (await res.json()) as { parentFolderId: number }
    expect(child.parentFolderId).toBe(parent.id)
  })

  it('GET /:folderId returns the folder', async () => {
    const app = makeApp()
    const created = (await (
      await app.fetch(
        new Request('http://localhost/api/spaces/1/folders', {
          method: 'POST',
          body: JSON.stringify({ name: 'Checkout' }),
        })
      )
    ).json()) as { id: number }

    const res = await app.fetch(new Request(`http://localhost/api/spaces/1/folders/${created.id}`))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { name: string }
    expect(data.name).toBe('Checkout')
  })

  it('GET /:folderId returns 404 for unknown id', async () => {
    const res = await makeApp().fetch(new Request('http://localhost/api/spaces/1/folders/999'))
    expect(res.status).toBe(404)
  })

  it('PUT /:folderId updates name', async () => {
    const app = makeApp()
    const created = (await (
      await app.fetch(
        new Request('http://localhost/api/spaces/1/folders', {
          method: 'POST',
          body: JSON.stringify({ name: 'Old' }),
        })
      )
    ).json()) as { id: number }

    const res = await app.fetch(
      new Request(`http://localhost/api/spaces/1/folders/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Renamed' }),
      })
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { name: string }
    expect(data.name).toBe('Renamed')
  })

  it('PUT /:folderId returns 404 for unknown id', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/spaces/1/folders/999', {
        method: 'PUT',
        body: JSON.stringify({ name: 'X' }),
      })
    )
    expect(res.status).toBe(404)
  })

  it('DELETE /:folderId removes the folder', async () => {
    const app = makeApp()
    const created = (await (
      await app.fetch(
        new Request('http://localhost/api/spaces/1/folders', {
          method: 'POST',
          body: JSON.stringify({ name: 'ToDelete' }),
        })
      )
    ).json()) as { id: number }

    const del = await app.fetch(
      new Request(`http://localhost/api/spaces/1/folders/${created.id}`, { method: 'DELETE' })
    )
    expect(del.status).toBe(200)
    expect(((await del.json()) as { success: boolean }).success).toBe(true)

    const get = await app.fetch(new Request(`http://localhost/api/spaces/1/folders/${created.id}`))
    expect(get.status).toBe(404)
  })

  it('scopes folders to their space', async () => {
    const app = makeApp()
    await app.fetch(
      new Request('http://localhost/api/spaces/1/folders', {
        method: 'POST',
        body: JSON.stringify({ name: 'Folder A' }),
      })
    )
    await app.fetch(
      new Request('http://localhost/api/spaces/2/folders', {
        method: 'POST',
        body: JSON.stringify({ name: 'Folder B' }),
      })
    )

    const list = (await (
      await app.fetch(new Request('http://localhost/api/spaces/1/folders'))
    ).json()) as { name: string }[]
    expect(list.map((f) => f.name)).toContain('Folder A')
    expect(list.map((f) => f.name)).not.toContain('Folder B')
  })
})
