import { ReactNode } from 'react'

interface Props {
  status: 'not_started' | 'pending' | 'generating' | 'ready' | 'failed'
  error?: string | null
  onRetry?: () => void
  children: ReactNode
}

export default function TabShell({ status, error, onRetry, children }: Props) {
  if (status === 'ready') {
    return <>{children}</>
  }

  if (status === 'failed') {
    return (
      <div className="glass-card-static p-8 text-center">
        <p className="text-sm mb-3" style={{ color: 'var(--error)' }}>
          {error || 'Something went wrong generating this section.'}
        </p>
        {onRetry && (
          <button className="btn-ghost" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="glass-card-static p-8 text-center">
      <div className="skeleton h-4 w-2/3 mx-auto mb-3" />
      <div className="skeleton h-4 w-1/2 mx-auto mb-3" />
      <div className="skeleton h-4 w-3/5 mx-auto" />
      <p className="text-xs mt-6" style={{ color: 'var(--outline)' }}>
        {status === 'not_started' ? 'Waiting to start…' : 'Generating…'}
      </p>
    </div>
  )
}
