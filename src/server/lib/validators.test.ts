import { describe, it, expect } from 'vitest'
import {
  validateAppName,
  validateCreateAppRequest,
  validateUpdateAppRequest,
} from './validators.js'

describe('Validators', () => {
  describe('validateAppName', () => {
    it('should accept non-empty names', () => {
      expect(validateAppName('Test App')).toBe(true)
      expect(validateAppName('App 123')).toBe(true)
    })

    it('should reject empty or whitespace names', () => {
      expect(validateAppName('')).toBe(false)
      expect(validateAppName('   ')).toBe(false)
    })
  })

  describe('validateCreateAppRequest', () => {
    it('should accept name and optional description', () => {
      expect(validateCreateAppRequest({ name: 'My App', description: 'desc' }).valid).toBe(true)
    })

    it('should accept name without description', () => {
      expect(validateCreateAppRequest({ name: 'My App' }).valid).toBe(true)
    })

    it('should reject missing name', () => {
      const result = validateCreateAppRequest({ description: 'desc' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject empty name', () => {
      const result = validateCreateAppRequest({ name: '   ' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })
  })

  describe('validateUpdateAppRequest', () => {
    it('should accept empty update', () => {
      expect(validateUpdateAppRequest({}).valid).toBe(true)
    })

    it('should accept valid name update', () => {
      expect(validateUpdateAppRequest({ name: 'Updated' }).valid).toBe(true)
    })

    it('should accept description-only update', () => {
      expect(validateUpdateAppRequest({ description: 'New desc' }).valid).toBe(true)
    })

    it('should reject empty name on update', () => {
      const result = validateUpdateAppRequest({ name: '   ' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })
  })
})
