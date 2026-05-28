import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { AppList } from './AppList.js'
import type { App } from '../../types/index.js'

const mockApps: App[] = [
  {
    id: 1,
    name: 'App 1',
    description: null,
    createdAt: '2024-05-14T10:00:00Z',
    updatedAt: '2024-05-14T10:00:00Z',
  },
  {
    id: 2,
    name: 'App 2',
    description: 'With description',
    createdAt: '2024-05-14T11:00:00Z',
    updatedAt: '2024-05-14T11:00:00Z',
  },
]

describe('AppList Component', () => {
  it('renders list title with app count', () => {
    render(<AppList apps={mockApps} onDelete={vi.fn()} />)
    expect(screen.getByText('Apps Under Test (2)')).toBeInTheDocument()
  })

  it('renders empty state when no apps', () => {
    render(<AppList apps={[]} onDelete={vi.fn()} />)
    expect(screen.getByText(/No apps added yet/)).toBeInTheDocument()
  })

  it('renders all app names', () => {
    render(<AppList apps={mockApps} onDelete={vi.fn()} />)
    expect(screen.getByText('App 1')).toBeInTheDocument()
    expect(screen.getByText('App 2')).toBeInTheDocument()
  })

  it('renders description when present', () => {
    render(<AppList apps={mockApps} onDelete={vi.fn()} />)
    expect(screen.getByText('With description')).toBeInTheDocument()
  })

  it('renders remove buttons for each app', () => {
    render(<AppList apps={mockApps} onDelete={vi.fn()} />)
    expect(screen.getAllByText('Remove')).toHaveLength(2)
  })

  it('updates count when apps change', () => {
    const { rerender } = render(<AppList apps={mockApps} onDelete={vi.fn()} />)
    expect(screen.getByText('Apps Under Test (2)')).toBeInTheDocument()
    rerender(<AppList apps={[mockApps[0]]} onDelete={vi.fn()} />)
    expect(screen.getByText('Apps Under Test (1)')).toBeInTheDocument()
  })
})
