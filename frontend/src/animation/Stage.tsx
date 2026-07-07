import { motion } from 'framer-motion'
import type { CanvasState, Component, TransientEffect } from './types'
import CharacterNode from './CharacterNode'
import ConnectionLayer from './ConnectionLayer'
import Overlay from './Overlay'
import { mapPosition } from './constants'

interface StageProps {
  canvas: CanvasState
  transient: TransientEffect | null
  components: Component[]
  mode: 'overview' | 'deepdive'
  onEnterDeepDive: (characterId: string) => void
  showHotspots: boolean
}

const BACKGROUND_CLASS: Record<CanvasState['background'], string> = {
  dark: 'bg-[#0c0c0f]',
  whiteboard: 'bg-[#f4f4f2]',
  blueprint: 'bg-[#0a1830]',
}

function BackgroundGrid({ style }: { style: CanvasState['background'] }) {
  if (style === 'whiteboard') {
    return (
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
    )
  }
  if (style === 'blueprint') {
    return (
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(120,170,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(120,170,255,0.14) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
    )
  }
  return (
    <div className="absolute inset-0 opacity-40">
      <div className="orb-blue opacity-20" />
      <div className="orb-purple opacity-20" />
    </div>
  )
}

export default function Stage({
  canvas, transient, components, mode, onEnterDeepDive, showHotspots,
}: StageProps) {
  const spotlightTarget = transient?.kind === 'spotlight' ? transient.targetId : null
  const dimOthers = transient?.kind === 'spotlight' ? transient.dimOthers : false

  const highlightedCharId = transient?.kind === 'highlight_character' ? transient.id : null
  const pulseCharId = highlightedCharId && transient?.kind === 'highlight_character' && transient.pulse
    ? transient.id
    : null

  return (
    <div className={`relative w-full h-full rounded-xl border border-white/10 overflow-hidden ${BACKGROUND_CLASS[canvas.background]}`}>
      <BackgroundGrid style={canvas.background} />

      <motion.div
        className="absolute inset-0"
        animate={{
          scale: canvas.camera.scale,
          x: `${(0.5 - canvas.camera.cx) * 100 * canvas.camera.scale}%`,
          y: `${(0.5 - canvas.camera.cy) * 100 * canvas.camera.scale}%`,
        }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        style={{ transformOrigin: '50% 50%' }}
      >
        <ConnectionLayer connections={canvas.connections} characters={canvas.characters} transient={transient} />

        {canvas.characters.map(char => {
          const isSpotlit = spotlightTarget === char.id
          const isDimmed = !!spotlightTarget && dimOthers && char.id !== spotlightTarget
          const isHighlighted = highlightedCharId === char.id
          const isPulsing = pulseCharId === char.id
          return (
            <CharacterNode
              key={char.id}
              character={char}
              isDimmed={isDimmed}
              isSpotlit={isSpotlit}
              isHighlighted={isHighlighted}
              isPulsing={isPulsing}
            />
          )
        })}

        {showHotspots && mode === 'overview' && components
          .filter(c => c.deep_dive?.scenes?.length > 0 && c.click_target?.position)
          .map(c => {
            const pos = mapPosition(c.click_target.position.x ?? 0.5, c.click_target.position.y ?? 0.5)
            return (
              <button
                key={c.character_id}
                onClick={() => onEnterDeepDive(c.character_id)}
                className="absolute z-30 flex items-center gap-1.5 group"
                style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
              >
                <motion.span
                  className="w-3 h-3 rounded-full bg-white/80"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/60 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {c.click_target.label ?? ''}
                </span>
              </button>
            )
          })}
      </motion.div>

      <Overlay transient={transient} characters={canvas.characters} />
    </div>
  )
}
