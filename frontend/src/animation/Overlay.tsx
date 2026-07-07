import { motion, AnimatePresence } from 'framer-motion'
import type { CharacterState, TransientEffect } from './types'
import { ANALOGY_ICON_MAP, mapPosition } from './constants'

interface OverlayProps {
  transient: TransientEffect | null
  characters: CharacterState[]
}

// Overlay only handles the 6 effect kinds that need stage-level chrome, not
// character/connection context. highlight_character, highlight_connection and
// animate_flow are rendered directly by CharacterNode / ConnectionLayer.
export default function Overlay({ transient, characters }: OverlayProps) {
  return (
    <AnimatePresence mode="wait">
      {transient?.kind === 'title' && (
        <motion.div
          key="title"
          className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex flex-col items-center gap-2 px-10 py-8 rounded-2xl border border-white/15 bg-black/40 backdrop-blur-xl text-center max-w-[80%]"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <h2 className="text-xl md:text-2xl font-semibold text-white">{transient.title}</h2>
            {transient.subtitle && (
              <p className="text-sm text-white/60">{transient.subtitle}</p>
            )}
          </motion.div>
        </motion.div>
      )}

      {transient?.kind === 'spotlight' && (
        <motion.div
          key="spotlight"
          className="absolute inset-0 z-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.55) 62%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}

      {transient?.kind === 'reveal_code' && (
        <motion.div
          key="reveal_code"
          className="absolute inset-0 flex items-center justify-center z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="w-[min(90%,32rem)] rounded-xl border border-white/10 bg-[#0d0d10]/95 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
              <span className="ml-2 text-xs font-mono text-white/60 truncate">{transient.file}</span>
              <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/15 text-white/50 whitespace-nowrap">
                Lines {transient.lines[0]}–{transient.lines[1]}
              </span>
            </div>
            <div className="px-4 py-4 text-sm text-white/75 leading-relaxed">
              {transient.annotation}
            </div>
          </div>
        </motion.div>
      )}

      {transient?.kind === 'callout' && (() => {
        const target = characters.find(c => c.id === transient.targetId)
        const pos = mapPosition(target?.x ?? 0.5, (target?.y ?? 0.5) - 0.15)
        return (
          <motion.div
            key="callout"
            className="absolute z-40 max-w-[220px]"
            style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -100%)' }}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div
              className={
                transient.style === 'thought'
                  ? 'rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-3 text-sm text-white/85'
                  : transient.style === 'speech'
                    ? 'rounded-xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-3 text-sm text-white/85 relative after:content-[""] after:absolute after:-bottom-2 after:left-6 after:w-3 after:h-3 after:bg-white/10 after:border-r after:border-b after:border-white/15 after:rotate-45'
                    : 'rounded-md border border-white/15 bg-black/50 backdrop-blur-md px-3 py-1.5 text-xs text-white/80'
              }
            >
              {transient.text}
            </div>
          </motion.div>
        )
      })()}

      {transient?.kind === 'analogy' && (() => {
        const Icon = ANALOGY_ICON_MAP[transient.icon]
        return (
          <motion.div
            key="analogy"
            className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex flex-col items-center gap-3 px-8 py-7 rounded-2xl border border-white/15 bg-black/40 backdrop-blur-xl text-center max-w-[70%]"
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              {Icon && <Icon className="w-9 h-9 text-white/70" />}
              <p className="text-sm md:text-base text-white/85">{transient.text}</p>
            </motion.div>
          </motion.div>
        )
      })()}

      {transient?.kind === 'step_sequence' && (
        <motion.div
          key="step_sequence"
          className="absolute inset-0 flex items-center justify-center z-40 p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {transient.style === 'arrow_chain' ? (
            <motion.div
              className="flex flex-wrap items-center justify-center gap-2"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.12 } } }}
            >
              {transient.steps.map((step, i) => (
                <motion.div key={i} className="flex items-center gap-2"
                  variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                >
                  <span className="px-3 py-1.5 rounded-full border border-white/15 bg-white/10 text-xs text-white/85 whitespace-nowrap">
                    {step}
                  </span>
                  {i < transient.steps.length - 1 && <span className="text-white/40 text-sm">&rarr;</span>}
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.ol
              className="flex flex-col gap-2 max-w-[70%]"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.15 } } }}
            >
              {transient.steps.map((step, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-3 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white/85"
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/15 text-[11px] flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </motion.li>
              ))}
            </motion.ol>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
