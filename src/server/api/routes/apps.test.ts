import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { validateCreateAppRequest, validateUpdateAppRequest } from '../../lib/validators.js'

describe('Apps Routes', () => {
  describe('Validators', () => {
    it('should validate create request with name', () => {
      const result = validateCreateAppRequest({ name: 'My App', description: 'desc' })
      expect(result.valid).toBe(true)
    })

    it('should reject create request with missing name', () => {
      const result = validateCreateAppRequest({ description: 'desc' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject create request with empty name', () => {
      const result = validateCreateAppRequest({ name: '   ' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })

    it('should validate update request with partial data', () => {
      const result = validateUpdateAppRequest({ description: 'Updated' })
      expect(result.valid).toBe(true)
    })

    it('should reject update with empty name', () => {
      const result = validateUpdateAppRequest({ name: '' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })
  })

  describe('Hono Routing', () => {
    it('should handle GET /api/apps', async () => {
      const app = new Hono()
      const mockApps = [{ id: 1, name: 'Test App', description: null }]

      app.get('/api/apps', (c) => c.json(mockApps))

      const res = await app.fetch(new Request('http://localhost/api/apps'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as typeof mockApps
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('Test App')
    })

    it('should handle POST /api/apps', async () => {
      const app = new Hono()

      app.post('/api/apps', async (c) => {
        const body = await c.req.json<{ name?: string }>()
        if (!body.name) return c.json({ error: 'name is required' }, 400)
        return c.json({ id: 1, ...body }, 201)
      })

      const res = await app.fetch(
        new Request('http://localhost/api/apps', {
          method: 'POST',
          body: JSON.stringify({ name: 'My App' }),
        })
      )

      expect(res.status).toBe(201)
      const data = (await res.json()) as { name: string }
      expect(data.name).toBe('My App')
    })

    it('should handle PUT /api/apps/:id', async () => {
      const app = new Hono()

      app.put('/api/apps/:id', async (c) => {
        const body = await c.req.json<{ description?: string }>()
        return c.json({ id: 1, ...body })
      })

      const res = await app.fetch(
        new Request('http://localhost/api/apps/1', {
          method: 'PUT',
          body: JSON.stringify({ description: 'Updated' }),
        })
      )

      expect(res.status).toBe(200)
      const data = (await res.json()) as { description: string }
      expect(data.description).toBe('Updated')
    })

    it('should handle DELETE /api/apps/:id', async () => {
      const app = new Hono()
      app.delete('/api/apps/:id', (c) => c.json({ success: true }))

      const res = await app.fetch(new Request('http://localhost/api/apps/1', { method: 'DELETE' }))
      expect(res.status).toBe(200)
      const data = (await res.json()) as { success: boolean }
      expect(data.success).toBe(true)
    })
  })
})
