import { motion, useReducedMotion } from 'framer-motion'
import type { CharacterState } from './types'
import { ICON_MAP, COLOR_MAP, mapPosition } from './constants'

interface CharacterNodeProps {
  character: CharacterState
  isDimmed?: boolean
  isSpotlit?: boolean
  isHighlighted?: boolean
  isPulsing?: boolean
}

export default function CharacterNode({
  character, isDimmed, isSpotlit, isHighlighted, isPulsing,
}: CharacterNodeProps) {
  const reduced = useReducedMotion()
  const Icon = ICON_MAP[character.icon] ?? ICON_MAP.file
  const colors = COLOR_MAP[character.color] ?? COLOR_MAP.blue
  const pos = mapPosition(character.x, character.y)
  const pulse = (isHighlighted || isPulsing) && !reduced

  return (
    <motion.div
      className="absolute flex flex-col items-center gap-1.5"
      style={{
        left: pos.left,
        top: pos.top,
        transform: 'translate(-50%, -50%)',
        zIndex: isSpotlit ? 30 : 10,
      }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: isDimmed ? 0.25 : 1, scale: isSpotlit ? 1.12 : 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <motion.div
        className="relative flex items-center justify-center rounded-2xl border backdrop-blur-md"
        style={{
          width: 56,
          height: 56,
          background: colors.bg,
          borderColor: isSpotlit ? colors.text : colors.ring,
          boxShadow: isSpotlit
            ? `0 0 32px ${colors.glow}, 0 0 12px ${colors.glow}`
            : `0 0 16px ${colors.glow}`,
        }}
        animate={pulse ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={pulse ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : {}}
      >
        <Icon className="w-6 h-6" style={{ color: colors.text }} />
        {pulse && (
          <motion.div
            className="absolute inset-0 rounded-2xl border pointer-events-none"
            style={{ borderColor: colors.text }}
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </motion.div>

      <span className="text-[11px] font-medium text-white/80 whitespace-nowrap px-1.5 py-0.5 rounded-md bg-black/30 backdrop-blur-sm">
        {character.label}
      </span>

      {character.annotation && (
        <span className="text-[10px] text-white/60 whitespace-nowrap px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 max-w-[140px] truncate">
          {character.annotation}
        </span>
      )}
    </motion.div>
  )
}
