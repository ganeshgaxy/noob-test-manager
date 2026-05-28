import type { App } from '../../types/index.js'

interface AppItemProps {
  app: App
  onDelete: (id: number) => void
}

export function AppItem({ app, onDelete }: AppItemProps) {
  return (
    <div className="app-item">
      <div className="app-info">
        <div className="app-name">{app.name}</div>
        <a className="app-url" href={app.url} target="_blank" rel="noopener noreferrer">
          {app.url}
        </a>
        {app.description && <div className="app-desc">{app.description}</div>}
      </div>
      <div className="app-actions">
        <button className="btn-danger" onClick={() => onDelete(app.id)}>
          Remove
        </button>
      </div>
    </div>
  )
}
