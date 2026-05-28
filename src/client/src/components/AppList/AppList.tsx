import type { App } from '../../types/index.js'
import { AppItem } from '../AppItem/AppItem.js'

interface AppListProps {
  apps: App[]
  onDelete: (id: number) => void
}

export function AppList({ apps, onDelete }: AppListProps) {
  return (
    <div className="card">
      <h2>Apps Under Test ({apps.length})</h2>
      {apps.length === 0 ? (
        <p className="empty">No apps added yet. Add your first app above.</p>
      ) : (
        <div className="apps-list">
          {apps.map((app) => (
            <AppItem key={app.id} app={app} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
