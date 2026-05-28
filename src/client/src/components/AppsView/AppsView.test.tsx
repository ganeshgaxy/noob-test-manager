import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppsView } from './AppsView.js'
import type { App } from '../../types/index.js'

const mockApps: App[] = [
  {
    id: 1,
    name: 'Alpha',
    description: 'First app',
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
]

describe('AppsView Component', () => {
  it('renders the Apps heading', () => {
    render(<AppsView apps={[]} onNavigate={vi.fn()} onAdd={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Apps')).toBeInTheDocument()
  })

  it('renders a New App button', () => {
    render(<AppsView apps={[]} onNavigate={vi.fn()} onAdd={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('New App')).toBeInTheDocument()
  })

  it('shows empty state when no apps', () => {
    render(<AppsView apps={[]} onNavigate={vi.fn()} onAdd={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('No apps yet')).toBeInTheDocument()
  })

  it('renders all app names when apps provided', () => {
    render(<AppsView apps={mockApps} onNavigate={vi.fn()} onAdd={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('renders app description when present', () => {
    render(<AppsView apps={mockApps} onNavigate={vi.fn()} onAdd={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('First app')).toBeInTheDocument()
  })

  it('calls onNavigate with spaces view when app row clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<AppsView apps={mockApps} onNavigate={onNavigate} onAdd={vi.fn()} onDelete={vi.fn()} />)
    await user.click(screen.getByText('Alpha'))
    expect(onNavigate).toHaveBeenCalledWith({ type: 'spaces', appId: 1 })
  })

  it('opens the create dialog when New App button clicked', async () => {
    const user = userEvent.setup()
    render(<AppsView apps={[]} onNavigate={vi.fn()} onAdd={vi.fn()} onDelete={vi.fn()} />)
    await user.click(screen.getByText('New App'))
    await waitFor(() => {
      expect(screen.getByPlaceholderText('My Application')).toBeInTheDocument()
    })
  })

  it('shows validation error in dialog when submitting without name', async () => {
    const user = userEvent.setup()
    render(<AppsView apps={[]} onNavigate={vi.fn()} onAdd={vi.fn()} onDelete={vi.fn()} />)
    await user.click(screen.getByText('New App'))
    await waitFor(() => screen.getByRole('dialog'))
    // Click the dialog's submit button (text "Create App" inside dialog)
    const submitButtons = screen.getAllByText('Create App')
    const dialogSubmit = submitButtons[submitButtons.length - 1]
    await user.click(dialogSubmit)
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })
  })

  it('calls onAdd when form submitted with valid name', async () => {
    const user = userEvent.setup()
    const onAdd = vi
      .fn()
      .mockResolvedValue({ id: 3, name: 'Gamma', description: null, createdAt: '', updatedAt: '' })
    render(<AppsView apps={[]} onNavigate={vi.fn()} onAdd={onAdd} onDelete={vi.fn()} />)
    await user.click(screen.getByText('New App'))
    await waitFor(() => screen.getByRole('dialog'))
    await user.type(screen.getByPlaceholderText('My Application'), 'Gamma')
    const submitButtons = screen.getAllByText('Create App')
    await user.click(submitButtons[submitButtons.length - 1])
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({ name: 'Gamma', description: undefined })
    })
  })
})
