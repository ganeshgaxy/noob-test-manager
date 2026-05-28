import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App.js'

const mockApps = [
  {
    id: 1,
    name: 'Test App',
    description: 'A test app',
    createdAt: '2024-05-14T00:00:00Z',
    updatedAt: '2024-05-14T00:00:00Z',
  },
]

function stubFetch(data: unknown = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(data) }))
  )
}

describe('App Component', () => {
  beforeEach(() => {
    stubFetch([])
    // Reset URL to root so URL-based routing starts at apps view
    window.history.replaceState(null, '', '/')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the header with app name', () => {
    render(<App />)
    expect(screen.getByText('noob-sdet')).toBeInTheDocument()
  })

  it('renders the Test Manager badge', () => {
    render(<App />)
    expect(screen.getByText('Test Manager')).toBeInTheDocument()
  })

  it('renders the Apps view by default', () => {
    render(<App />)
    expect(screen.getAllByText('Apps').length).toBeGreaterThan(0)
    expect(screen.getByText('New App')).toBeInTheDocument()
  })

  it('shows empty state when no apps', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('No apps yet')).toBeInTheDocument()
    })
  })

  it('displays fetched apps in the list', async () => {
    stubFetch(mockApps)
    render(<App />)
    await waitFor(() => {
      expect(screen.getAllByText('Test App').length).toBeGreaterThan(0)
    })
  })

  it('displays multiple apps', async () => {
    stubFetch([
      {
        id: 1,
        name: 'Alpha',
        description: null,
        createdAt: '2024-05-14T00:00:00Z',
        updatedAt: '2024-05-14T00:00:00Z',
      },
      {
        id: 2,
        name: 'Beta',
        description: null,
        createdAt: '2024-05-14T00:00:00Z',
        updatedAt: '2024-05-14T00:00:00Z',
      },
    ])
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
      expect(screen.getByText('Beta')).toBeInTheDocument()
    })
  })
})
