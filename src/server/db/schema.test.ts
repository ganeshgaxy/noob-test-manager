import { describe, it, expect } from 'vitest'
import {
  apps,
  spaces,
  folders,
  tests,
  testSteps,
  bddScenarios,
  bddSteps,
  testHistory,
  testRuns,
  testPackItems,
  runResults,
  runStepResults,
  customFields,
  customFieldValues,
  appSettings,
  appIntegrations,
} from './schema.js'

describe('Database Schema', () => {
  describe('apps table', () => {
    it('has required columns', () => {
      const cols = Object.keys(apps)
      expect(cols).toContain('id')
      expect(cols).toContain('name')
      expect(cols).toContain('description')
      expect(cols).toContain('createdAt')
      expect(cols).toContain('updatedAt')
    })

    it('does not have a url column', () => {
      expect(Object.keys(apps)).not.toContain('url')
    })

    it('accepts null description', () => {
      const row: typeof apps.$inferSelect = {
        id: 1,
        name: 'My App',
        description: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }
      expect(row.description).toBeNull()
    })

    it('infers insert type with only name required', () => {
      const insert: typeof apps.$inferInsert = { name: 'New App' }
      expect(insert.name).toBe('New App')
    })
  })

  describe('spaces table', () => {
    it('has required columns', () => {
      const cols = Object.keys(spaces)
      expect(cols).toContain('id')
      expect(cols).toContain('appId')
      expect(cols).toContain('name')
      expect(cols).toContain('description')
      expect(cols).toContain('createdAt')
      expect(cols).toContain('updatedAt')
    })
  })

  describe('folders table', () => {
    it('supports nesting via parentFolderId', () => {
      const cols = Object.keys(folders)
      expect(cols).toContain('spaceId')
      expect(cols).toContain('parentFolderId')
      expect(cols).toContain('order')
    })
  })

  describe('tests table', () => {
    it('has all required columns', () => {
      const cols = Object.keys(tests)
      expect(cols).toContain('folderId')
      expect(cols).toContain('type')
      expect(cols).toContain('title')
      expect(cols).toContain('priority')
      expect(cols).toContain('status')
      expect(cols).toContain('tags')
      expect(cols).toContain('preconditions')
      expect(cols).toContain('notes')
      expect(cols).toContain('assigneeId')
      expect(cols).toContain('createdBy')
      expect(cols).toContain('updatedBy')
    })
  })

  describe('testSteps table', () => {
    it('has action and expectedResult columns', () => {
      const cols = Object.keys(testSteps)
      expect(cols).toContain('testId')
      expect(cols).toContain('action')
      expect(cols).toContain('expectedResult')
      expect(cols).toContain('order')
    })
  })

  describe('bddScenarios and bddSteps tables', () => {
    it('bddScenarios has feature and scenario columns', () => {
      const cols = Object.keys(bddScenarios)
      expect(cols).toContain('testId')
      expect(cols).toContain('feature')
      expect(cols).toContain('scenario')
    })

    it('bddSteps has type and text columns', () => {
      const cols = Object.keys(bddSteps)
      expect(cols).toContain('scenarioId')
      expect(cols).toContain('type')
      expect(cols).toContain('text')
    })
  })

  describe('testHistory table', () => {
    it('has audit log columns', () => {
      const cols = Object.keys(testHistory)
      expect(cols).toContain('testId')
      expect(cols).toContain('field')
      expect(cols).toContain('oldValue')
      expect(cols).toContain('newValue')
      expect(cols).toContain('changedBy')
    })
  })

  describe('testRuns table', () => {
    it('has run lifecycle columns', () => {
      const cols = Object.keys(testRuns)
      expect(cols).toContain('appId')
      expect(cols).toContain('name')
      expect(cols).toContain('status')
      expect(cols).toContain('environment')
      expect(cols).toContain('createdBy')
    })
  })

  describe('testPackItems table', () => {
    it('has scopeType and scopeId columns', () => {
      const cols = Object.keys(testPackItems)
      expect(cols).toContain('runId')
      expect(cols).toContain('scopeType')
      expect(cols).toContain('scopeId')
    })
  })

  describe('runResults and runStepResults tables', () => {
    it('runResults has status and execution columns', () => {
      const cols = Object.keys(runResults)
      expect(cols).toContain('runId')
      expect(cols).toContain('testId')
      expect(cols).toContain('status')
      expect(cols).toContain('executedBy')
      expect(cols).toContain('executedAt')
    })

    it('runStepResults links to runResult and step', () => {
      const cols = Object.keys(runStepResults)
      expect(cols).toContain('runResultId')
      expect(cols).toContain('stepType')
      expect(cols).toContain('stepId')
      expect(cols).toContain('status')
    })
  })

  describe('customFields table', () => {
    it('has field definition columns', () => {
      const cols = Object.keys(customFields)
      expect(cols).toContain('appId')
      expect(cols).toContain('name')
      expect(cols).toContain('type')
      expect(cols).toContain('options')
      expect(cols).toContain('required')
      expect(cols).toContain('defaultValue')
      expect(cols).toContain('order')
    })

    it('infers select type correctly', () => {
      const row: typeof customFields.$inferSelect = {
        id: 1,
        appId: 1,
        name: 'Sprint',
        type: 'text',
        options: null,
        required: false,
        defaultValue: null,
        order: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }
      expect(row.name).toBe('Sprint')
      expect(row.type).toBe('text')
    })
  })

  describe('customFieldValues table', () => {
    it('links test to field with a value', () => {
      const cols = Object.keys(customFieldValues)
      expect(cols).toContain('testId')
      expect(cols).toContain('fieldId')
      expect(cols).toContain('value')
    })

    it('allows null value', () => {
      const row: typeof customFieldValues.$inferSelect = {
        id: 1,
        testId: 10,
        fieldId: 3,
        value: null,
      }
      expect(row.value).toBeNull()
    })
  })

  describe('appSettings table', () => {
    it('has key/value columns scoped to an app', () => {
      const cols = Object.keys(appSettings)
      expect(cols).toContain('appId')
      expect(cols).toContain('key')
      expect(cols).toContain('value')
    })

    it('infers insert type correctly', () => {
      const row: typeof appSettings.$inferInsert = {
        appId: 1,
        key: 'defaultPriority',
        value: '"medium"',
      }
      expect(row.key).toBe('defaultPriority')
    })
  })

  describe('appIntegrations table', () => {
    it('has integration columns', () => {
      const cols = Object.keys(appIntegrations)
      expect(cols).toContain('appId')
      expect(cols).toContain('type')
      expect(cols).toContain('config')
      expect(cols).toContain('enabled')
    })

    it('infers select type correctly', () => {
      const row: typeof appIntegrations.$inferSelect = {
        id: 1,
        appId: 1,
        type: 'jira',
        config: '{}',
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }
      expect(row.type).toBe('jira')
      expect(row.enabled).toBe(true)
    })
  })
})
