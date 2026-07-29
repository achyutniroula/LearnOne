import { lazy, Suspense } from 'react'
import { DiagramSpec, specToMermaid } from '../../utils/diagramToMermaid'

const MermaidBlock = lazy(() => import('../MermaidBlock'))

export default function DiagramView({ spec }: { spec: DiagramSpec | null | undefined }) {
  if (!spec) return null
  const code = specToMermaid(spec)
  if (!code) return null

  return (
    <Suspense fallback={<div className="skeleton h-32 w-full my-4" />}>
      <MermaidBlock code={code} />
    </Suspense>
  )
}
