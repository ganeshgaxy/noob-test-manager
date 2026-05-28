import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { Header } from './Header.js'

describe('Header Component', () => {
  it('renders the app name', () => {
    render(<Header />)
    expect(screen.getByText('noob-sdet')).toBeInTheDocument()
  })

  it('renders the badge with correct text', () => {
    render(<Header />)
    expect(screen.getByText('Test Manager')).toBeInTheDocument()
  })

  it('renders as a header element', () => {
    const { container } = render(<Header />)
    expect(container.querySelector('header')).toBeInTheDocument()
  })
})
