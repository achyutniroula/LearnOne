import { useState, useEffect } from 'react'
import { reviewApi, ReviewDue } from '../api/review'
import clsx from 'clsx'

const QUALITY_LABELS = ['Blackout', 'Wrong', 'Familiar', 'Hard', 'Good', 'Easy']
const QUALITY_COLORS = ['#ee7d77', '#ee7d77', '#ffc87c', '#ffc87c', '#64c8ff', '#6ee7b7']

export default function ReviewPanel() {
  const [reviews, setReviews] = useState<ReviewDue[]>([])
  const [current, setCurrent] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reviewApi.getDue().then(setReviews).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function rate(quality: number) {
    const r = reviews[current]
    if (!r) return
    await reviewApi.record(r.conceptSlug, quality).catch(() => {})
    setRevealed(false)
    setCurrent((c) => c + 1)
  }

  if (loading) return <p className="text-xs" style={{ color: 'var(--outline)' }}>Loading…</p>

  if (reviews.length === 0) return (
    <p className="text-xs" style={{ color: 'var(--outline)' }}>
      No reviews due. Keep learning to build your review queue!
    </p>
  )

  const done = current >= reviews.length
  if (done) return (
    <div className="text-center">
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--on-surface)' }}>Session complete!</p>
      <p className="text-xs" style={{ color: 'var(--on-muted)' }}>{reviews.length} concept{reviews.length !== 1 ? 's' : ''} reviewed.</p>
    </div>
  )

  const r = reviews[current]
  const progress = `${current + 1} / ${reviews.length}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--outline)' }}>
          {progress}
        </span>
        <div className="h-[2px] flex-1 mx-3 rounded-full" style={{ background: 'var(--outline-dim)' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(current / reviews.length) * 100}%`, background: '#64c8ff' }} />
        </div>
      </div>

      <div className="glass-card p-4 text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--on-surface)' }}>{r.conceptLabel}</p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--outline)' }}>
          Rep {r.repetitions} · interval {r.intervalDays}d
        </p>
      </div>

      {!revealed ? (
        <button className="btn-primary text-xs w-full" onClick={() => setRevealed(true)}>
          Reveal
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-center uppercase tracking-widest" style={{ color: 'var(--outline)' }}>
            How well did you recall this?
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {QUALITY_LABELS.map((label, q) => (
              <button
                key={q}
                onClick={() => rate(q)}
                className={clsx('text-xs rounded-lg py-2 border transition-all hover:opacity-80')}
                style={{
                  borderColor: `${QUALITY_COLORS[q]}40`,
                  background: `${QUALITY_COLORS[q]}12`,
                  color: QUALITY_COLORS[q],
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
