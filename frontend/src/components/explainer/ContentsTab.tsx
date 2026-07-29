export interface ContentsComponent {
  name: string
  description: string
  files: string[]
}

export interface ContentsContent {
  components: ContentsComponent[]
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function ContentsTab({ content }: { content: ContentsContent }) {
  function goTo(name: string) {
    const el = document.getElementById(`component-${slugify(name)}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="max-w-2xl mx-auto py-4 grid gap-4">
      {content.components.map((c) => (
        <button
          key={c.name}
          onClick={() => goTo(c.name)}
          className="glass-card text-left p-5"
        >
          <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--on-surface)' }}>
            {c.name}
          </h3>
          <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--on-muted)' }}>
            {c.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {c.files.map((f) => (
              <span key={f} className="badge font-mono text-[10px]">
                {f}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  )
}
