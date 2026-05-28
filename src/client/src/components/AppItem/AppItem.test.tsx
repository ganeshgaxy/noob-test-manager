import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppItem } from './AppItem.js'
import type { App } from '../../types/index.js'

const mockApp: App = {
  id: 1,
  name: 'Test App',
  description: 'A test app',
  createdAt: '2024-05-14T10:00:00Z',
  updatedAt: '2024-05-14T10:00:00Z',
}

describe('AppItem Component', () => {
  it('renders app name', () => {
    render(<AppItem app={mockApp} onDelete={vi.fn()} />)
    expect(screen.getByText('Test App')).toBeInTheDocument()
  })

  it('renders description when present', () => {
    render(<AppItem app={mockApp} onDelete={vi.fn()} />)
    expect(screen.getByText('A test app')).toBeInTheDocument()
  })

  it('does not render description when absent', () => {
    render(<AppItem app={{ ...mockApp, description: null }} onDelete={vi.fn()} />)
    expect(screen.queryByText('A test app')).not.toBeInTheDocument()
  })

  it('calls onDelete with the app id when remove button clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<AppItem app={mockApp} onDelete={onDelete} />)
    await user.click(screen.getByText('Remove'))
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('renders a remove button', () => {
    render(<AppItem app={mockApp} onDelete={vi.fn()} />)
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })
})
