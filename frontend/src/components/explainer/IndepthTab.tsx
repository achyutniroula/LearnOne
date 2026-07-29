import { useState } from 'react'
import { ChevronDown, ChevronRight, FileCode } from 'lucide-react'
import DiagramView from './DiagramView'
import { DiagramSpec } from '../../utils/diagramToMermaid'
import { slugify } from './ContentsTab'

export interface IndepthSection {
  component_name: string
  explanation: string
  code_reference: { file: string; lines: null }
  diagram: DiagramSpec | null
}

export interface IndepthContent {
  sections: IndepthSection[]
}

export default function IndepthTab({ content }: { content: IndepthContent }) {
  const [openSet, setOpenSet] = useState<Set<string>>(new Set(content.sections.map((s) => s.component_name)))

  function toggle(name: string) {
    setOpenSet((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="max-w-2xl mx-auto py-4 grid gap-3">
      {content.sections.map((s) => {
        const open = openSet.has(s.component_name)
        return (
          <div key={s.component_name} id={`component-${slugify(s.component_name)}`} className="glass-card-static p-5">
            <button
              onClick={() => toggle(s.component_name)}
              className="w-full flex items-center justify-between text-left"
            >
              <h3 className="text-sm font-medium" style={{ color: 'var(--on-surface)' }}>
                {s.component_name}
              </h3>
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {open && (
              <div className="mt-3">
                <p className="leading-relaxed mb-3" style={{ color: 'var(--on-muted)' }}>
                  {s.explanation}
                </p>
                {s.code_reference?.file && (
                  <div className="flex items-center gap-1.5 mb-3 font-mono text-xs" style={{ color: 'var(--outline)' }}>
                    <FileCode className="w-3.5 h-3.5" />
                    {s.code_reference.file}
                  </div>
                )}
                <DiagramView spec={s.diagram} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
