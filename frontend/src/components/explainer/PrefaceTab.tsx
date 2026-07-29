import DiagramView from './DiagramView'
import { DiagramSpec } from '../../utils/diagramToMermaid'

export interface PrefaceContent {
  one_line: string
  what_it_does: string
  why_it_exists: string
  diagram: DiagramSpec | null
}

export default function PrefaceTab({ content }: { content: PrefaceContent }) {
  return (
    <div className="max-w-2xl mx-auto py-4">
      <h2 className="text-xl font-light mb-6" style={{ color: 'var(--on-surface)' }}>
        {content.one_line}
      </h2>
      <section className="mb-6">
        <h3 className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--outline)' }}>
          What it does
        </h3>
        <p className="leading-relaxed" style={{ color: 'var(--on-muted)' }}>
          {content.what_it_does}
        </p>
      </section>
      <section className="mb-6">
        <h3 className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--outline)' }}>
          Why it exists
        </h3>
        <p className="leading-relaxed" style={{ color: 'var(--on-muted)' }}>
          {content.why_it_exists}
        </p>
      </section>
      <DiagramView spec={content.diagram} />
    </div>
  )
}
