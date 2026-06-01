import { motion } from 'framer-motion'
import { Plus, Mic } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import LeonOrb from './LeonOrb'
import type { OrbState } from '../../hooks/useLeonState'

interface LeonStageProps {
  orbState: OrbState
  sessionActive: boolean
  onStartSession: () => void
  /** MessageList + LeonInputBar passed from the parent */
  children: React.ReactNode
}

/**
 * LeonStage controls the macro layout.
 *
 * Hero mode  (no active session): orb centered, tagline, Start Session button
 * Companion mode (session active): orb docked top-center, messages scroll below
 *
 * The LeonOrb's `layoutId="leon-orb-root"` enables the shared-layout animation
 * between hero and companion positions.
 */
export default function LeonStage({
  orbState,
  sessionActive,
  onStartSession,
  children,
}: LeonStageProps) {
  const navigate = useNavigate()

  if (!sessionActive) {
    return (
      <div
        className="flex flex-col flex-1 min-w-0 relative"
        style={{ minHeight: 0 }}
      >
        {/* Background ambient orbs */}
        <div className="orb-blue" />
        <div className="orb-purple" />

        {/* Hero center content */}
        <motion.div
          className="flex flex-col items-center justify-center flex-1 gap-8 px-4 relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Orb hero size — layout animation flies it to companion on activation */}
          <LeonOrb state={orbState} size="hero" />

          <div className="flex flex-col items-center gap-3 text-center" style={{ marginTop: 16 }}>
            <h2
              className="text-2xl font-light tracking-wide"
              style={{ color: 'var(--on-surface)' }}
            >
              What do you want to{' '}
              <span className="rgb-text-gradient">learn</span>?
            </h2>
            <p className="text-sm max-w-xs" style={{ color: 'var(--on-muted)' }}>
              Start a session and I'll build a personalised curriculum for you.
            </p>
            <div className="flex gap-3 mt-2">
              <button onClick={() => navigate('/talk')} className="btn-primary">
                <Mic className="w-4 h-4" />
                Talk to LEON
              </button>
              <button onClick={onStartSession} className="btn-ghost">
                <Plus className="w-4 h-4" />
                New Session
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Companion / active session layout ───────────────────────────────────
  return (
    <div
      className="flex flex-col flex-1 min-w-0 relative"
      style={{ minHeight: 0 }}
    >
      {/* Orb docked top-center — layout animation moves it from hero */}
      <motion.div
        layout
        className="flex justify-center pt-3 pb-1 flex-shrink-0"
        style={{ position: 'relative', zIndex: 1 }}
      >
        <LeonOrb state={orbState} size="companion" />
      </motion.div>

      {/* Message feed + input bar — passed as children */}
      <div className="flex flex-col flex-1 min-h-0">
        {children}
      </div>
    </div>
  )
}
