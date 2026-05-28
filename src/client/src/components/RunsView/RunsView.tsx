import { Play, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button.js'
import type { View } from '../../types/index.js'

interface Props {
  appId: number
  onNavigate: (v: View) => void
  onCreateRun?: () => void
}

export function RunsView({ appId: _appId, onNavigate: _onNavigate, onCreateRun }: Props) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--t-bg-base)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 48,
          borderBottom: '1px solid var(--t-border-subtle)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>Runs</span>
        {onCreateRun && (
          <Button
            onClick={onCreateRun}
            variant="outline"
            style={{ gap: 6, height: 30, fontSize: 12, padding: '0 12px' }}
          >
            <Plus size={13} />
            Create Run
          </Button>
        )}
      </div>

      {/* Empty state */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'var(--t-bg-panel)',
              border: '1px solid var(--t-border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Play size={24} weight="duotone" color="var(--t-text-muted)" />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)' }}>
              No run selected
            </p>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 5 }}>
              Create a run to start executing your test cases.
            </p>
          </div>
          {onCreateRun && (
            <Button onClick={onCreateRun} variant="outline" style={{ gap: 6 }}>
              <Plus size={14} />
              Create Run
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
