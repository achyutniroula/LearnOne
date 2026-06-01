import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { OrbState } from '../../hooks/useLeonState'

interface LeonOrbProps {
  state: OrbState
  size?: 'hero' | 'companion'
}

const SIZE = { hero: 180, companion: 64 } as const

// Per-state colour palette — hue only, opacity controlled per layer
const PALETTE: Record<OrbState, { r: number; g: number; b: number }> = {
  idle:      { r: 80,  g: 180, b: 255 },  // cool cyan-blue
  listening: { r: 40,  g: 130, b: 255 },  // electric blue
  thinking:  { r: 180, g: 90,  b: 255 },  // violet
  speaking:  { r: 0,   g: 220, b: 180 },  // teal-green
}

const rgba = (c: { r: number; g: number; b: number }, a: number) =>
  `rgba(${c.r},${c.g},${c.b},${a})`

// Smooth ease for infinite loops
const LOOP = (duration: number) => ({ duration, repeat: Infinity, ease: 'easeInOut' as const })

export default function LeonOrb({ state, size = 'hero' }: LeonOrbProps) {
  const reduced = useReducedMotion()
  const px      = SIZE[size]
  const c       = PALETTE[state]
  const isHero  = size === 'hero'

  const glow0  = rgba(c, 0.18)   // outer ambient
  const glow1  = rgba(c, 0.35)   // mid haze
  const border = rgba(c, 0.28)
  const inner  = rgba(c, 0.20)
  const shine  = rgba(c, 0.50)

  return (
    <motion.div
      layout
      layoutId="leon-orb-root"
      style={{ width: px, height: px, position: 'relative', flexShrink: 0 }}
    >

      {/* ── Layer A: Outer ambient halo ───────────────────────────────────── */}
      <motion.div
        style={{
          position: 'absolute',
          width: px * 2.8,
          height: px * 2.8,
          top: '50%', left: '50%',
          x: '-50%', y: '-50%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glow0} 0%, transparent 68%)`,
          filter: `blur(${isHero ? 48 : 20}px)`,
          pointerEvents: 'none',
        }}
        animate={reduced ? { opacity: 0.6 } : {
          opacity: state === 'idle'      ? [0.55, 0.85, 0.55] :
                   state === 'listening' ? [0.7,  1.0,  0.7]  :
                   state === 'thinking'  ? [0.5,  0.9,  0.5]  :
                                          [0.65, 1.0,  0.65],
          scale:  state === 'idle'       ? [1, 1.08, 1] :
                  state === 'listening'  ? [1, 1.14, 1] :
                  state === 'speaking'   ? [1, 1.10, 1] : [1, 1, 1],
        }}
        transition={reduced ? {} : LOOP(
          state === 'idle' ? 3.5 : state === 'listening' ? 1.0 : state === 'speaking' ? 1.4 : 2.5
        )}
      />

      {/* ── Layer B: Mid atmospheric glow ────────────────────────────────── */}
      <motion.div
        style={{
          position: 'absolute',
          width: px * 1.55,
          height: px * 1.55,
          top: '50%', left: '50%',
          x: '-50%', y: '-50%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glow1} 0%, transparent 70%)`,
          filter: `blur(${isHero ? 18 : 8}px)`,
          pointerEvents: 'none',
        }}
        animate={reduced ? { opacity: 0.7 } : {
          opacity: state === 'thinking' ? [0.45, 0.9, 0.45] : [0.6, 0.95, 0.6],
          scale:   state === 'listening' ? [1, 1.1, 1] : [1, 1.04, 1],
        }}
        transition={reduced ? {} : LOOP(
          state === 'idle' ? 3.0 : state === 'listening' ? 0.9 : 2.2
        )}
      />

      {/* ── Layer C: Glass sphere (main body) ────────────────────────────── */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle at 38% 32%,
            ${rgba(c, 0.22)} 0%,
            ${rgba(c, 0.09)} 55%,
            ${rgba(c, 0.04)} 100%)`,
          border: `1px solid ${border}`,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          boxShadow: [
            `0 0 ${isHero ? 56 : 22}px ${rgba(c, 0.45)}`,
            `0 0 ${isHero ? 20 : 8}px  ${rgba(c, 0.25)}`,
            `inset 0 0 ${isHero ? 28 : 12}px ${inner}`,
            `inset 0 1px 0 rgba(255,255,255,0.12)`,
          ].join(', '),
          overflow: 'hidden',
        }}
        animate={reduced ? {} : {
          scale: state === 'idle'      ? [1, 1.035, 1] :
                 state === 'listening' ? [1, 1.06,  1] :
                 state === 'thinking'  ? [1, 0.97,  1] :
                                        [1, 1.04,  1],
        }}
        transition={reduced ? {} : LOOP(
          state === 'idle' ? 3.5 : state === 'listening' ? 0.85 : state === 'thinking' ? 2.0 : 1.3
        )}
      >
        {/* Inner plasma light — floats around inside the sphere */}
        <motion.div
          style={{
            position: 'absolute',
            width: '62%', height: '62%',
            top: '15%', left: '18%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${rgba(c, 0.45)} 0%, transparent 75%)`,
            filter: `blur(${isHero ? 10 : 5}px)`,
          }}
          animate={reduced ? {} : {
            x: [0, isHero ? 14 : 5,  isHero ? -10 : -4, isHero ? 8 : 3, 0],
            y: [0, isHero ? -10 : -4, isHero ? 12 : 5, isHero ? -6 : -2, 0],
            opacity: [0.6, 1, 0.7, 0.9, 0.6],
          }}
          transition={reduced ? {} : {
            duration: state === 'thinking' ? 2.5 : 4.5,
            repeat: Infinity, ease: 'easeInOut',
          }}
        />

        {/* Top-left glass highlight */}
        <div style={{
          position: 'absolute',
          top: '9%', left: '16%',
          width: '36%', height: '28%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 100%)',
          filter: 'blur(5px)',
          pointerEvents: 'none',
        }} />

        {/* Bottom-right depth shadow */}
        <div style={{
          position: 'absolute',
          bottom: '6%', right: '8%',
          width: '44%', height: '36%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${rgba(c, 0.18)} 0%, transparent 100%)`,
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }} />

        {/* Thin rim highlight */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${shine} 0%, transparent 45%, transparent 55%, ${rgba(c, 0.1)} 100%)`,
          opacity: 0.35,
          pointerEvents: 'none',
        }} />
      </motion.div>

      {/* ── Layer D: Ripple rings (listening) ────────────────────────────── */}
      <AnimatePresence>
        {state === 'listening' && !reduced && [0, 1, 2].map(i => (
          <motion.div
            key={`ripple-${i}`}
            style={{
              position: 'absolute',
              width: px, height: px,
              top: 0, left: 0,
              borderRadius: '50%',
              border: `1px solid ${rgba(c, 0.5)}`,
              pointerEvents: 'none',
            }}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2.4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.0, delay: i * 0.65, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>

      {/* ── Layer E: Waveform bars (speaking) ────────────────────────────── */}
      <AnimatePresence>
        {state === 'speaking' && (
          <motion.div
            key="waveform"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              x: '-50%',
              y: '-50%',
              display: 'flex',
              alignItems: 'center',
              gap: isHero ? 4 : 2,
            }}
          >
            {[0, 0.12, 0.22, 0.08, 0.18, 0.05, 0.15].map((delay, i) => (
              <motion.div
                key={i}
                style={{
                  width: isHero ? 3 : 2,
                  height: isHero ? 18 : 9,
                  borderRadius: 3,
                  background: `linear-gradient(to top, ${rgba(c, 0.4)}, ${rgba(c, 0.9)})`,
                  originY: 0.5,
                }}
                animate={reduced ? { scaleY: 0.6 } : { scaleY: [0.25, 1.3, 0.25] }}
                transition={reduced ? {} : {
                  duration: 0.65, delay,
                  repeat: Infinity, ease: 'easeInOut',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Layer F: Thinking orbit particle ─────────────────────────────── */}
      <AnimatePresence>
        {state === 'thinking' && !reduced && (
          <motion.div
            key="orbit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute',
              width: px * 1.35, height: px * 1.35,
              top: '50%', left: '50%',
              x: '-50%', y: '-50%',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              style={{
                position: 'absolute',
                width: isHero ? 8 : 4,
                height: isHero ? 8 : 4,
                borderRadius: '50%',
                background: rgba(c, 0.9),
                boxShadow: `0 0 ${isHero ? 12 : 6}px ${rgba(c, 0.8)}`,
                top: '0%',
                left: '50%',
                x: '-50%',
                transformOrigin: `50% ${px * 0.675}px`,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
