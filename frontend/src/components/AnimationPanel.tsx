import { useEffect } from 'react'
import { X } from 'lucide-react'
import LeonOrb from './leon/LeonOrb'
import { useAnimationScript } from '../hooks/useAnimationScript'
import AnimationRenderer from '../animation/AnimationRenderer'
import type { AnimationScript } from '../animation/types'

interface AnimationPanelProps {
  sessionId: number
  onClose: () => void
}

function isValidScript(script: unknown): script is AnimationScript {
  if (!script || typeof script !== 'object') return false
  const s = script as Record<string, unknown>
  const overview = s.overview as Record<string, unknown> | undefined
  return Array.isArray(overview?.scenes) && Array.isArray(s.components)
}

export default function AnimationPanel({ sessionId, onClose }: AnimationPanelProps) {
  const { status, script, error, generate } = useAnimationScript(sessionId)

  useEffect(() => {
    generate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#09090b]/95 backdrop-blur-xl">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb-blue opacity-30" />
        <div className="orb-purple opacity-30" />
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Content area */}
      {status === 'ready' && isValidScript(script) ? (
        <div className="flex-1 flex flex-col w-full h-full max-w-[1600px] relative py-4">
          <AnimationRenderer script={script} onClose={onClose} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-10 w-full max-w-3xl text-center relative">
          {(status === 'idle' || status === 'pending') && (
            <>
              <LeonOrb state="thinking" size="hero" />
              <p className="text-sm uppercase tracking-[0.2em] text-[#8e8e93] font-medium">
                LEON is preparing your explainer...
              </p>
            </>
          )}

          {status === 'story_pending' && (
            <div className="flex flex-col items-center gap-6">
              <LeonOrb state="idle" size="hero" />
              <p className="text-base font-light text-[#c6c6c8]">
                LEON is still indexing this repo. Check back in a moment.
              </p>
              <button
                onClick={onClose}
                className="btn-ghost"
              >
                Close
              </button>
            </div>
          )}

          {status === 'failed' && (
            <div className="flex flex-col items-center gap-6 max-w-sm">
              <LeonOrb state="idle" size="hero" />
              <p className="text-sm text-red-400 leading-relaxed">
                {error ?? 'Script generation failed.'}
              </p>
              <button
                onClick={onClose}
                className="btn-primary w-full"
              >
                Ask LEON about this repo instead
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
