import { motion, useReducedMotion } from 'framer-motion'
import type { CharacterState, ConnectionState, TransientEffect } from './types'
import { mapPositionSvg } from './constants'
import { resolveConnectionId } from './canvasReducer'

interface ConnectionLayerProps {
  connections: ConnectionState[]
  characters: CharacterState[]
  transient: TransientEffect | null
}

const PARTICLE_COLOR: Record<string, string> = {
  data: '#7dd3fc',
  audio: '#c4b5fd',
  request: '#86efac',
  response: '#fde68a',
}

export default function ConnectionLayer({ connections, characters, transient }: ConnectionLayerProps) {
  const reduced = useReducedMotion()
  const findChar = (id: string) => characters.find(c => c.id === id)

  const highlightConn = transient?.kind === 'highlight_connection' ? transient : null
  const flowConn = transient?.kind === 'animate_flow'
    ? resolveConnectionId(connections, transient.connectionId)
    : null

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <marker id="arrow-end" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L6,3 L0,6 Z" fill="rgba(255,255,255,0.55)" />
        </marker>
      </defs>

      {connections.map((conn) => {
        const from = findChar(conn.from)
        const to = findChar(conn.to)
        if (!from || !to) return null

        const a = mapPositionSvg(from.x, from.y)
        const b = mapPositionSvg(to.x, to.y)
        const midX = (a.cx + b.cx) / 2
        const midY = (a.cy + b.cy) / 2
        const path = `M ${a.cx} ${a.cy} L ${b.cx} ${b.cy}`

        const isHighlighted = !!highlightConn &&
          ((highlightConn.from === conn.from && highlightConn.to === conn.to) ||
           (highlightConn.from === conn.to && highlightConn.to === conn.from))
        const isFlowing = !!flowConn && flowConn.from === conn.from && flowConn.to === conn.to

        return (
          <g key={`${conn.from}-${conn.to}`}>
            <motion.path
              d={path}
              fill="none"
              stroke={isHighlighted ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)'}
              strokeWidth={isHighlighted ? 0.6 : 0.35}
              strokeDasharray={conn.style === 'dashed' ? '2 2' : undefined}
              markerEnd="url(#arrow-end)"
              markerStart={conn.direction === 'two_way' ? 'url(#arrow-end)' : undefined}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 1,
                strokeDashoffset: conn.style === 'animated' && !reduced ? [0, -8] : 0,
              }}
              transition={{
                pathLength: { duration: 0.7, ease: 'easeOut' },
                opacity: { duration: 0.4 },
                strokeDashoffset: conn.style === 'animated' && !reduced
                  ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
                  : {},
              }}
              style={isHighlighted ? { filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.8))' } : undefined}
            />

            {conn.label && (
              <g transform={`translate(${midX}, ${midY})`}>
                <rect x={-10} y={-2.6} width={20} height={5.2} rx={2} fill="rgba(9,9,11,0.75)" />
                <text
                  x={0} y={0.4}
                  textAnchor="middle"
                  fontSize="2.6"
                  fill="rgba(255,255,255,0.7)"
                >
                  {conn.label.length > 18 ? `${conn.label.slice(0, 17)}…` : conn.label}
                </text>
              </g>
            )}

            {isFlowing && transient?.kind === 'animate_flow' && (
              <motion.circle
                r={1.6}
                fill={PARTICLE_COLOR[transient.particle] ?? '#7dd3fc'}
                initial={{ cx: a.cx, cy: a.cy, opacity: 0 }}
                animate={reduced
                  ? { cx: b.cx, cy: b.cy, opacity: 0.9 }
                  : { cx: [a.cx, b.cx], cy: [a.cy, b.cy], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.2, repeat: reduced ? 0 : Infinity, ease: 'linear' }}
                style={{ filter: `drop-shadow(0 0 3px ${PARTICLE_COLOR[transient.particle] ?? '#7dd3fc'})` }}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
