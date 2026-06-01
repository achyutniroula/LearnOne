import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, Mic, MicOff, Square, VolumeX } from 'lucide-react'
import clsx from 'clsx'
import api from '../api/api'
import { useVoice } from '../hooks/useVoice'
import { useLeonState } from '../hooks/useLeonState'
import LeonOrb from '../components/leon/LeonOrb'

interface Msg { id: number; role: 'user' | 'assistant'; content: string }

let _id = 0
const nextId = () => ++_id

export default function TalkPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversing, setConversing] = useState(false)
  const [muted, setMuted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const conversingRef = useRef(false)

  const voice = useVoice()
  const orbState = useLeonState({ listening: voice.listening, loading, speaking: voice.speaking })

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { conversingRef.current = conversing }, [conversing])

  function stopConversation() {
    setConversing(false); conversingRef.current = false
    setMuted(false)
    voice.stopListening(); voice.cancelSpeak()
  }

  function toggleMute() {
    if (muted) {
      setMuted(false)
      voice.startListening(send)
    } else {
      setMuted(true)
      voice.stopListening()
    }
  }

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    const newMsg: Msg = { id: nextId(), role: 'user', content: trimmed }
    setMessages(prev => [...prev, newMsg])
    setInput('')
    setLoading(true)
    const history = [...messages, newMsg].slice(-10).map(m => ({ role: m.role, content: m.content }))
    try {
      const { data } = await api.post<{ content: string }>('/api/leon/chat', {
        message: trimmed, history: history.slice(0, -1),
      })
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: data.content }])
      voice.speak(data.content)
      if (conversingRef.current) { setMuted(false); voice.startListening(send) }
    } catch {
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: '_Could not reach LEON._' }])
    } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  const statusLabel =
    voice.interimTranscript ? voice.interimTranscript :
    muted                    ? 'Muted'       :
    orbState === 'listening' ? 'Listening…' :
    orbState === 'thinking'  ? 'Thinking…'  :
    orbState === 'speaking'  ? 'Speaking…'  :
    conversing               ? 'Mic open…'  :
    'Tap to start'

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="orb-blue" /><div className="orb-purple" />

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-5 flex-shrink-0 relative z-10"
        style={{ height: 57, background: 'rgba(14,14,15,0.8)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(72,72,75,0.18)' }}>
        <button onClick={() => navigate('/chat')} className="btn-ghost flex items-center gap-2 px-3">
          <ArrowLeft className="w-3.5 h-3.5" /><span className="hidden sm:inline text-xs">Back</span>
        </button>
        <div className="text-center">
          <span className="text-sm tracking-[0.3em] uppercase select-none">
            <span className="rgb-text-gradient font-normal">LEON</span>
          </span>
          <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--outline)' }}>Voice Agent</p>
        </div>
        {voice.speaking
          ? <button onClick={voice.cancelSpeak} className="btn-ghost flex items-center gap-1.5 px-3"><Square className="w-3 h-3" /><span className="text-xs hidden sm:inline">Stop</span></button>
          : <button onClick={() => setMessages([])} className="btn-ghost px-3 text-xs" style={{ color: 'var(--outline)' }}>Clear</button>
        }
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(100,200,255,0.2), rgba(198,119,221,0.15), transparent)' }} />
      </nav>

      {/* ── Two-column body ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative z-10">

        {/* LEFT — chat messages */}
        <div className="flex flex-col flex-1 min-w-0 border-r" style={{ borderColor: 'rgba(72,72,75,0.15)' }}>
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 pt-6 pb-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-sm mt-6" style={{ color: 'var(--outline)' }}>
                Say anything — this is just between you and LEON.
              </motion.p>
            )}
            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                  className={clsx('max-w-[88%] rounded-[10px] px-4 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user' ? 'self-end' : 'self-start glass-card-static')}
                  style={msg.role === 'user' ? {
                    background: 'rgba(100,200,255,0.08)',
                    border: '1px solid rgba(100,200,255,0.15)',
                    color: 'var(--on-surface)',
                  } : { color: 'var(--on-surface)' }}
                >
                  {msg.role === 'assistant'
                    ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                    : <span>{msg.content}</span>}
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <div className="self-start glass-card-static px-4 py-2.5 flex gap-1">
                <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Text input */}
          <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(72,72,75,0.18)' }}>
            <form onSubmit={e => { e.preventDefault(); send(input) }} className="flex gap-2">
              <input className="input-base text-sm" placeholder="Or type here…"
                value={input} onChange={e => setInput(e.target.value)}
                disabled={loading || voice.listening} />
              <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-4 py-2 flex-shrink-0 text-xs">Send</button>
            </form>
          </div>
        </div>

        {/* RIGHT — orb panel */}
        <div className="flex flex-col items-center justify-center gap-6 flex-shrink-0 px-10"
          style={{ width: 340 }}>

          <p className="text-[11px] tracking-widest uppercase" style={{ color: 'var(--on-muted)' }}>
            {statusLabel}
          </p>

          <LeonOrb state={orbState} size="hero" />

          {/* Mic button */}
          {voice.supported ? (
            <button
              onClick={() => conversing ? stopConversation() : (setConversing(true), voice.startListening(send))}
              disabled={loading}
              className={clsx(
                'w-20 h-20 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-200 border focus:outline-none',
                conversing
                  ? 'border-[rgba(100,200,255,0.6)] bg-[rgba(100,200,255,0.1)]'
                  : 'border-[var(--glass-border)] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)]'
              )}
              style={conversing ? { boxShadow: '0 0 32px rgba(100,200,255,0.25)' } : {}}
            >
              {conversing
                ? <><MicOff className="w-6 h-6" style={{ color: 'rgba(100,200,255,0.9)' }} /><span className="text-[9px] tracking-wider uppercase" style={{ color: 'rgba(100,200,255,0.7)' }}>End</span></>
                : <><Mic className="w-6 h-6" style={{ color: 'var(--on-muted)' }} /><span className="text-[9px] tracking-wider uppercase" style={{ color: 'var(--outline)' }}>Talk</span></>
              }
            </button>
          ) : (
            <p className="text-xs text-center" style={{ color: 'var(--outline)' }}>Use Chrome or Edge for voice</p>
          )}

          {/* Mute toggle — only visible while conversing */}
          <AnimatePresence>
            {conversing && (
              <motion.button
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                onClick={toggleMute}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-xs tracking-wider uppercase transition-all duration-200 border',
                  muted
                    ? 'border-[rgba(238,125,119,0.5)] bg-[rgba(238,125,119,0.1)] text-[rgba(238,125,119,0.9)]'
                    : 'border-[var(--glass-border)] bg-transparent text-[var(--outline)] hover:text-[var(--on-muted)]'
                )}
              >
                <VolumeX className="w-3.5 h-3.5" />
                {muted ? 'Unmute' : 'Mute'}
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {voice.micError && (
              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs text-center px-4 max-w-[260px]" style={{ color: 'var(--error)' }}>
                {voice.micError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
