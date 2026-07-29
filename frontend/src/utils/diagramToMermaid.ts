export type DiagramSpec = {
  type: 'flow' | 'hierarchy' | 'sequence'
  nodes: { id: string; label: string }[]
  edges: { from: string; to: string; label?: string }[]
}

function sanitizeLabel(label: string): string {
  return label
    .replace(/[[\](){}|"<>`]/g, '')
    .replace(/\r?\n/g, ' ')
    .trim()
}

export function specToMermaid(spec: DiagramSpec): string {
  if (!spec || !Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return ''
  }

  const nodes = spec.nodes
  const edges = spec.edges ?? []

  if (spec.type === 'sequence') {
    const lines: string[] = ['sequenceDiagram']
    for (const n of nodes) {
      lines.push(`  participant ${n.id} as ${sanitizeLabel(n.label)}`)
    }
    for (const e of edges) {
      const label = e.label ? sanitizeLabel(e.label) : ''
      lines.push(`  ${e.from}->>${e.to}: ${label}`)
    }
    return lines.join('\n')
  }

  const direction = spec.type === 'hierarchy' ? 'TD' : 'LR'
  const lines: string[] = [`flowchart ${direction}`]
  for (const n of nodes) {
    lines.push(`  ${n.id}["${sanitizeLabel(n.label)}"]`)
  }
  for (const e of edges) {
    if (e.label) {
      lines.push(`  ${e.from} -->|${sanitizeLabel(e.label)}| ${e.to}`)
    } else {
      lines.push(`  ${e.from} --> ${e.to}`)
    }
  }
  return lines.join('\n')
}
