import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppForm } from './AppForm.js'

describe('AppForm Component', () => {
  it('renders form title', () => {
    const mockSubmit = vi.fn()
    render(<AppForm onSubmit={mockSubmit} />)
    expect(screen.getByText('Add App Under Test')).toBeInTheDocument()
  })

  it('renders all input fields', () => {
    const mockSubmit = vi.fn()
    render(<AppForm onSubmit={mockSubmit} />)
    expect(screen.getByPlaceholderText('App name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('https://your-app.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Description (optional)')).toBeInTheDocument()
  })

  it('renders submit button', () => {
    const mockSubmit = vi.fn()
    render(<AppForm onSubmit={mockSubmit} />)
    expect(screen.getByText('Add App')).toBeInTheDocument()
  })

  it('shows error when required fields are empty', async () => {
    const user = userEvent.setup()
    const mockSubmit = vi.fn()
    render(<AppForm onSubmit={mockSubmit} />)

    const button = screen.getByText('Add App')
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText(/Name and URL are required/)).toBeInTheDocument()
    })
  })

  it('calls onSubmit with form data', async () => {
    const user = userEvent.setup()
    const mockSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AppForm onSubmit={mockSubmit} />)

    const nameInput = screen.getByPlaceholderText('App name')
    const urlInput = screen.getByPlaceholderText('https://your-app.com')
    const descInput = screen.getByPlaceholderText('Description (optional)')
    const button = screen.getByText('Add App')

    await user.type(nameInput, 'Test App')
    await user.type(urlInput, 'https://test.com')
    await user.type(descInput, 'Test Description')
    await user.click(button)

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        name: 'Test App',
        url: 'https://test.com',
        description: 'Test Description',
      })
    })
  })

  it('clears form after successful submission', async () => {
    const user = userEvent.setup()
    const mockSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AppForm onSubmit={mockSubmit} />)

    const nameInput = screen.getByPlaceholderText('App name') as HTMLInputElement
    const urlInput = screen.getByPlaceholderText('https://your-app.com') as HTMLInputElement
    const button = screen.getByText('Add App')

    await user.type(nameInput, 'Test App')
    await user.type(urlInput, 'https://test.com')
    await user.click(button)

    await waitFor(() => {
      expect(nameInput.value).toBe('')
      expect(urlInput.value).toBe('')
    })
  })

  it('disables inputs while loading', () => {
    const mockSubmit = vi.fn()
    render(<AppForm onSubmit={mockSubmit} isLoading={true} />)

    expect(screen.getByPlaceholderText('App name')).toBeDisabled()
    expect(screen.getByPlaceholderText('https://your-app.com')).toBeDisabled()
    expect(screen.getByText('Adding...')).toBeInTheDocument()
  })
})
