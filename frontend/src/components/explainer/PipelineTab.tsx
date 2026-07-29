import DiagramView from './DiagramView'
import { DiagramSpec } from '../../utils/diagramToMermaid'

export interface PipelineStep {
  step_number: number
  title: string
  description: string
  diagram: DiagramSpec | null
}

export interface PipelineContent {
  steps: PipelineStep[]
}

export default function PipelineTab({ content }: { content: PipelineContent }) {
  return (
    <div className="max-w-2xl mx-auto py-4">
      {content.steps
        .slice()
        .sort((a, b) => a.step_number - b.step_number)
        .map((step) => (
          <section key={step.step_number} className="mb-10">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-2xl font-thin" style={{ color: 'var(--outline)' }}>
                {String(step.step_number).padStart(2, '0')}
              </span>
              <h3 className="text-lg font-light" style={{ color: 'var(--on-surface)' }}>
                {step.title}
              </h3>
            </div>
            <p className="leading-relaxed mb-3" style={{ color: 'var(--on-muted)' }}>
              {step.description}
            </p>
            <DiagramView spec={step.diagram} />
          </section>
        ))}
    </div>
  )
}
