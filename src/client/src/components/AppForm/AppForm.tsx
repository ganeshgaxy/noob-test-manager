import { useState } from 'react'
import type { CreateAppPayload, AppFormData } from '../../types/index.js'

interface AppFormProps {
  onSubmit: (data: CreateAppPayload) => Promise<void>
  isLoading?: boolean
}

const emptyForm: AppFormData = { name: '', url: '', description: '' }

export function AppForm({ onSubmit, isLoading = false }: AppFormProps) {
  const [form, setForm] = useState<AppFormData>(emptyForm)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name.trim() || !form.url.trim()) {
      setError('Name and URL are required.')
      return
    }

    try {
      await onSubmit({
        name: form.name,
        url: form.url,
        description: form.description || undefined,
      })
      setForm(emptyForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <div className="card">
      <h2>Add App Under Test</h2>
      <form className="form" onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            placeholder="App name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            disabled={isLoading}
          />
          <input
            placeholder="https://your-app.com"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            disabled={isLoading}
          />
        </div>
        <input
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          disabled={isLoading}
        />
        {error && <p className="error">{error}</p>}
        <div>
          <button className="btn-primary" type="submit" disabled={isLoading}>
            {isLoading ? 'Adding...' : 'Add App'}
          </button>
        </div>
      </form>
    </div>
  )
}
