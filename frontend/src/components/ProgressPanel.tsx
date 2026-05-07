import { useState, useEffect } from 'react'
import { progressApi, Progress } from '../api/progress'

export default function ProgressPanel() {
  const [data, setData] = useState<Progress | null>(null)

  useEffect(() => {
    progressApi.get().then(setData).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = () => setTimeout(() => progressApi.get().then(setData).catch(() => {}), 2500)
    window.addEventListener('chat:turn-complete', handler)
    return () => window.removeEventListener('chat:turn-complete', handler)
  }, [])

  if (!data || data.totalConcepts === 0) return (
    <p className="text-xs" style={{ color: 'var(--outline)' }}>
      No concepts tracked yet. Chat to build your progress.
    </p>
  )

  const bars = [
    { label: 'Mastered', count: data.masteredCount, color: '#6ee7b7' },
    { label: 'Learning', count: data.learningCount, color: '#64c8ff' },
    { label: 'Struggling', count: data.strugglingCount, color: '#ee7d77' },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Overall mastery ring (simplified as text stat) */}
      <div className="glass-card p-4 text-center">
        <p className="text-2xl font-light" style={{ color: 'var(--on-surface)' }}>
          {data.averageMastery.toFixed(0)}<span className="text-sm">%</span>
        </p>
        <p className="text-[10px] mt-0.5 uppercase tracking-widest" style={{ color: 'var(--outline)' }}>
          Avg mastery · {data.totalConcepts} concept{data.totalConcepts !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Breakdown bars */}
      {bars.map(({ label, count, color }) => (
        <div key={label} className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--on-muted)' }}>{label}</span>
            <span className="text-xs" style={{ color }}>{count}</span>
          </div>
          <div className="h-[3px] rounded-full" style={{ background: 'var(--outline-dim)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${data.totalConcepts ? (count / data.totalConcepts) * 100 : 0}%`,
                background: color,
              }}
            />
          </div>
        </div>
      ))}

      {/* Reviews due */}
      {data.reviewsDue > 0 && (
        <div className="glass-card p-3 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--on-muted)' }}>Reviews due</span>
          <span className="badge" style={{ background: '#ee7d7720', color: '#ee7d77', borderColor: '#ee7d7740' }}>
            {data.reviewsDue}
          </span>
        </div>
      )}
    </div>
  )
}
