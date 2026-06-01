import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Square } from 'lucide-react'
import type { UseVoiceReturn } from '../../hooks/useVoice'

interface VoiceControlProps {
  voice: UseVoiceReturn
  onFinalTranscript: (text: string) => void
  disabled?: boolean
}

/**
 * Renders mic toggle + interim transcript bubble + stop-speaking button.
 * Returns null when the Web Speech API is not supported (text input is the fallback).
 */
export default function VoiceControl({ voice, onFinalTranscript, disabled = false }: VoiceControlProps) {
  if (!voice.supported) return null

  const { listening, speaking, interimTranscript, startListening, stopListening, cancelSpeak } = voice

  const handleMicClick = () => {
    if (listening) {
      stopListening()
    } else {
      startListening(onFinalTranscript)
    }
  }

  return (
    <div className="relative flex items-center gap-1.5 flex-shrink-0">
      {/* ── Interim transcript bubble ──────────────────────────────────── */}
      <AnimatePresence>
        {interimTranscript && (
          <motion.div
            key="interim"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              bottom: '110%',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: 8,
              padding: '6px 12px',
              whiteSpace: 'nowrap',
              fontSize: 12,
              color: 'var(--on-muted)',
              backdropFilter: 'blur(16px)',
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            {interimTranscript}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stop-speaking button ────────────────────────────────────────── */}
      <AnimatePresence>
        {speaking && (
          <motion.button
            key="stop-speaking"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            type="button"
            onClick={cancelSpeak}
            title="Stop speaking"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,255,200,0.08)',
              border: '1px solid rgba(0,255,200,0.25)',
              color: 'rgba(0,255,200,0.85)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Square className="w-3.5 h-3.5" fill="currentColor" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Mic button ─────────────────────────────────────────────────── */}
      <motion.button
        type="button"
        onClick={handleMicClick}
        disabled={disabled}
        title={listening ? 'Stop listening' : 'Start voice input'}
        animate={listening ? { boxShadow: ['0 0 0 0 rgba(50,150,255,0.5)', '0 0 0 8px rgba(50,150,255,0)', '0 0 0 0 rgba(50,150,255,0.5)'] } : {}}
        transition={listening ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: listening ? 'rgba(50,150,255,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${listening ? 'rgba(50,150,255,0.5)' : 'var(--glass-border)'}`,
          color: listening ? 'rgba(50,150,255,0.9)' : 'var(--outline)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          flexShrink: 0,
          transition: 'background 0.2s, border-color 0.2s, color 0.2s',
        }}
      >
        {listening ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </motion.button>
    </div>
  )
}
