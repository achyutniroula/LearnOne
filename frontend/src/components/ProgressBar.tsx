interface ProgressBarProps {
  percent: number | null // null = indeterminate
  label: string
}

export default function ProgressBar({ percent, label }: ProgressBarProps) {
  const clamped = percent === null ? null : Math.max(0, Math.min(100, percent))

  return (
    <div className="w-full">
      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--surface-high)' }}
        role="progressbar"
        aria-valuenow={clamped ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {clamped === null ? (
          <div className="skeleton h-full w-full" />
        ) : (
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${clamped}%`, background: 'var(--primary)' }}
          />
        )}
      </div>
      <div className="text-xs mt-2" style={{ color: 'var(--on-muted)' }}>
        {label}
      </div>
    </div>
  )
}
