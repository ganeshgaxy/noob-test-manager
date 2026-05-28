import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'

function makeSpacesRouter() {
  const router = new Hono<{ Variables: { appId: number } }>()
  const store: Record<
    number,
    { id: number; appId: number; name: string; description: string | null }
  > = {}
  let nextId = 1

  router.get('/', (c) => {
    const appId = Number(c.req.param('appId'))
    return c.json(Object.values(store).filter((s) => s.appId === appId))
  })

  router.post('/', async (c) => {
    const appId = Number(c.req.param('appId'))
    const body = await c.req.json<{ name?: string; description?: string }>()
    if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
    const space = {
      id: nextId++,
      appId,
      name: body.name.trim(),
      description: body.description ?? null,
    }
    store[space.id] = space
    return c.json(space, 201)
  })

  router.get('/:spaceId', (c) => {
    const id = Number(c.req.param('spaceId'))
    const space = store[id]
    if (!space) return c.json({ error: 'not found' }, 404)
    return c.json(space)
  })

  router.put('/:spaceId', async (c) => {
    const id = Number(c.req.param('spaceId'))
    const body = await c.req.json<{ name?: string; description?: string }>()
    if (!store[id]) return c.json({ error: 'not found' }, 404)
    store[id] = { ...store[id], ...body }
    return c.json(store[id])
  })

  router.delete('/:spaceId', (c) => {
    const id = Number(c.req.param('spaceId'))
    if (!store[id]) return c.json({ error: 'not found' }, 404)
    delete store[id]
    return c.json({ success: true })
  })

  return router
}

describe('Spaces Routes', () => {
  function makeApp() {
    const app = new Hono()
    app.route('/api/apps/:appId/spaces', makeSpacesRouter())
    return app
  }

  it('GET / returns empty list for a new app', async () => {
    const res = await makeApp().fetch(new Request('http://localhost/api/apps/1/spaces'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('POST / creates a space and returns 201', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/apps/1/spaces', {
        method: 'POST',
        body: JSON.stringify({ name: 'Web' }),
      })
    )
    expect(res.status).toBe(201)
    const data = (await res.json()) as { name: string; appId: number }
    expect(data.name).toBe('Web')
    expect(data.appId).toBe(1)
  })

  it('POST / returns 400 when name is missing', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/apps/1/spaces', {
        method: 'POST',
        body: JSON.stringify({ description: 'no name' }),
      })
    )
    expect(res.status).toBe(400)
    const err = (await res.json()) as { error: string }
    expect(err.error).toContain('name')
  })

  it('POST / returns 400 when name is blank', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/apps/1/spaces', {
        method: 'POST',
        body: JSON.stringify({ name: '   ' }),
      })
    )
    expect(res.status).toBe(400)
  })

  it('GET /:spaceId returns the space', async () => {
    const app = makeApp()
    const created = (await (
      await app.fetch(
        new Request('http://localhost/api/apps/1/spaces', {
          method: 'POST',
          body: JSON.stringify({ name: 'Mobile' }),
        })
      )
    ).json()) as { id: number }

    const res = await app.fetch(new Request(`http://localhost/api/apps/1/spaces/${created.id}`))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { name: string }
    expect(data.name).toBe('Mobile')
  })

  it('GET /:spaceId returns 404 for unknown id', async () => {
    const res = await makeApp().fetch(new Request('http://localhost/api/apps/1/spaces/999'))
    expect(res.status).toBe(404)
  })

  it('PUT /:spaceId updates name', async () => {
    const app = makeApp()
    const created = (await (
      await app.fetch(
        new Request('http://localhost/api/apps/1/spaces', {
          method: 'POST',
          body: JSON.stringify({ name: 'Old' }),
        })
      )
    ).json()) as { id: number }

    const res = await app.fetch(
      new Request(`http://localhost/api/apps/1/spaces/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'New' }),
      })
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { name: string }
    expect(data.name).toBe('New')
  })

  it('PUT /:spaceId returns 404 for unknown id', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/apps/1/spaces/999', {
        method: 'PUT',
        body: JSON.stringify({ name: 'X' }),
      })
    )
    expect(res.status).toBe(404)
  })

  it('DELETE /:spaceId removes the space', async () => {
    const app = makeApp()
    const created = (await (
      await app.fetch(
        new Request('http://localhost/api/apps/1/spaces', {
          method: 'POST',
          body: JSON.stringify({ name: 'ToDelete' }),
        })
      )
    ).json()) as { id: number }

    const del = await app.fetch(
      new Request(`http://localhost/api/apps/1/spaces/${created.id}`, { method: 'DELETE' })
    )
    expect(del.status).toBe(200)
    const data = (await del.json()) as { success: boolean }
    expect(data.success).toBe(true)

    const get = await app.fetch(new Request(`http://localhost/api/apps/1/spaces/${created.id}`))
    expect(get.status).toBe(404)
  })

  it('DELETE /:spaceId returns 404 for unknown id', async () => {
    const res = await makeApp().fetch(
      new Request('http://localhost/api/apps/1/spaces/999', { method: 'DELETE' })
    )
    expect(res.status).toBe(404)
  })

  it('scopes spaces to their app', async () => {
    const app = makeApp()
    await app.fetch(
      new Request('http://localhost/api/apps/1/spaces', {
        method: 'POST',
        body: JSON.stringify({ name: 'Space A' }),
      })
    )
    await app.fetch(
      new Request('http://localhost/api/apps/2/spaces', {
        method: 'POST',
        body: JSON.stringify({ name: 'Space B' }),
      })
    )

    const res = await app.fetch(new Request('http://localhost/api/apps/1/spaces'))
    const list = (await res.json()) as { name: string }[]
    expect(list.map((s) => s.name)).toContain('Space A')
    expect(list.map((s) => s.name)).not.toContain('Space B')
  })
})
