import { useState, useEffect, useRef, FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Plus, LogOut, MessageSquare, Mic } from 'lucide-react'
import clsx from 'clsx'
import { sessionsApi, Session, Message, Curriculum } from '../api/sessions'
import { useAuth } from '../contexts/AuthContext'
import RightPanel from '../components/RightPanel'
import CodeBlock from '../components/CodeBlock'
import MermaidBlock from '../components/MermaidBlock'
import LeonStage from '../components/leon/LeonStage'
import LeonInputBar from '../components/leon/LeonInputBar'
import VoiceSession from '../components/leon/VoiceSession'
import { useVoice } from '../hooks/useVoice'
import { useLeonState } from '../hooks/useLeonState'
import 'katex/dist/katex.min.css'

interface DiagramMap { [msgId: number]: string }

let _msgId = 0
const nextId = () => ++_msgId

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { logout } = useAuth()
  const navigate = useNavigate()

  // ── Data state ─────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [loading, setLoading] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newGoal, setNewGoal] = useState('')
  const [creatingSession, setCreatingSession] = useState(false)
  const [diagrams, setDiagrams] = useState<DiagramMap>({})
  const [showVoiceSession, setShowVoiceSession] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const id = sessionId ? parseInt(sessionId) : null

  // ── Voice + orb state ──────────────────────────────────────────────────
  const voice = useVoice()
  const orbState = useLeonState({
    listening: voice.listening,
    loading,
    speaking: voice.speaking,
  })

  // ── Data fetching ──────────────────────────────────────────────────────
  function handleApiError(err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 401 || status === 403) { logout(); navigate('/login') }
  }

  useEffect(() => {
    sessionsApi.list().then(setSessions).catch(handleApiError)
  }, [])

  useEffect(() => {
    if (!id) return
    sessionsApi.messages(id).then(setMessages).catch(handleApiError)
    sessionsApi.curriculum(id).then(setCurriculum).catch(handleApiError)
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send a message ─────────────────────────────────────────────────────
  async function handleSend(text: string, imageData?: string, imageMediaType?: string) {
    if (!text.trim() || !id || loading) return
    const userMsg = text.trim()

    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'USER',
        content: userMsg,
        imageData,
        imageMediaType,
        createdAt: new Date().toISOString(),
      },
    ])
    setLoading(true)

    try {
      const reply = await sessionsApi.chat(id, userMsg, imageData, imageMediaType)
      const aiId = nextId()
      setMessages((prev) => [
        ...prev,
        { id: aiId, role: 'ASSISTANT', content: reply.content, createdAt: new Date().toISOString() },
      ])
      if (reply.diagramCode) {
        setDiagrams((prev) => ({ ...prev, [aiId]: reply.diagramCode! }))
      }
      window.dispatchEvent(new Event('chat:turn-complete'))
      // Speak the reply
      voice.speak(reply.content)
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'ASSISTANT',
          content: '_Error: could not reach the server._',
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // ── Create new session ─────────────────────────────────────────────────
  async function handleCreateSession(e: FormEvent) {
    e.preventDefault()
    if (!newGoal.trim()) return
    setCreatingSession(true)
    try {
      const session = await sessionsApi.create(newGoal.trim())
      setSessions((prev) => [session, ...prev])
      setShowNewModal(false)
      setNewGoal('')
      navigate(`/chat/${session.id}`)
    } catch {
      alert('Failed to create session.')
    } finally {
      setCreatingSession(false)
    }
  }

  const activeSession = sessions.find((s) => s.id === id)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6"
        style={{
          height: 57,
          background: 'rgba(14,14,15,0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(72,72,75,0.22)',
        }}
      >
        {/* LEON wordmark */}
        <span
          className="text-base tracking-[0.3em] uppercase font-light select-none"
          style={{ color: 'var(--on-surface)' }}
        >
          <span className="rgb-text-gradient font-normal">LEON</span>
        </span>

        {activeSession && (
          <span
            className="text-xs truncate max-w-xs hidden md:block"
            style={{ color: 'var(--on-muted)' }}
          >
            {activeSession.learningGoal}
          </span>
        )}

        <button
          onClick={() => { logout(); navigate('/login') }}
          className="btn-ghost flex items-center gap-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </button>

        {/* Gradient line below nav */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(to right, transparent, rgba(100,200,255,0.25), rgba(198,119,221,0.2), rgba(0,255,200,0.15), transparent)',
          }}
        />
      </nav>

      {/* ── Left Sidebar ────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex fixed left-0 flex-col z-40"
        style={{
          top: 57,
          width: 256,
          height: 'calc(100vh - 57px)',
          background: 'rgba(17,19,23,0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="p-4 flex flex-col gap-2">
          <button
            onClick={() => {
              if (id) {
                setShowVoiceSession(true)
              } else {
                setShowNewModal(true)
              }
            }}
            className="btn-primary w-full flex items-center gap-2"
            style={{ background: 'rgba(100,200,255,0.07)', borderColor: 'rgba(100,200,255,0.25)' }}
          >
            <Mic className="w-3.5 h-3.5" />
            Talk to LEON
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="btn-ghost w-full flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            New Session
          </button>
        </div>
        <div className="mx-4 h-px" style={{ background: 'rgba(72,72,75,0.3)' }} />

        <div className="flex-1 overflow-y-auto no-scrollbar py-2">
          {sessions.length === 0 && (
            <p className="px-6 text-xs" style={{ color: 'var(--outline)' }}>
              No sessions yet.
            </p>
          )}
          {sessions.map((sess) => {
            const active = sess.id === id
            return (
              <button
                key={sess.id}
                onClick={() => navigate(`/chat/${sess.id}`)}
                className={clsx(
                  'flex items-center gap-3 w-full px-6 py-3 text-left text-sm transition-all',
                  active
                    ? 'text-[#e2e2e8] bg-white/[0.04]'
                    : 'text-[#c6c6c7]/40 hover:text-[#c6c6c7] hover:bg-[#1e2024]'
                )}
                style={
                  active
                    ? { borderLeft: '2px solid rgba(198,198,199,0.6)' }
                    : { borderLeft: '2px solid transparent' }
                }
              >
                <MessageSquare
                  className={clsx(
                    'w-3.5 h-3.5 flex-shrink-0',
                    active ? 'text-[#c6c6c8]' : 'opacity-40'
                  )}
                />
                <span className="truncate font-light">
                  {sess.title || sess.learningGoal}
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── Main layout (sidebar offset) ────────────────────────────────── */}
      <div className="flex flex-1 md:ml-64 mt-[57px] min-w-0 overflow-hidden">

        {/* ── LeonStage + chat area ──────────────────────────────────────── */}
        <LeonStage
          orbState={orbState}
          sessionActive={!!id}
          onStartSession={() => setShowNewModal(true)}
        >
          {/* MessageList */}
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4 no-scrollbar">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={clsx(
                    'max-w-[78%] rounded-[10px] px-4 py-3 text-sm leading-relaxed',
                    msg.role === 'USER' ? 'self-end' : 'self-start glass-card-static'
                  )}
                  style={
                    msg.role === 'USER'
                      ? {
                          background: 'rgba(198,198,200,0.09)',
                          border: '1px solid rgba(198,198,200,0.15)',
                          color: 'var(--on-surface)',
                        }
                      : { color: 'var(--on-surface)' }
                  }
                >
                  {msg.imageData && msg.imageMediaType && (
                    <img
                      src={`data:${msg.imageMediaType};base64,${msg.imageData}`}
                      alt="attachment"
                      className="rounded-lg mb-3 max-h-64 max-w-full object-contain"
                    />
                  )}
                  {msg.role === 'ASSISTANT' ? (
                    <>
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          code({ className, children }) {
                            const lang =
                              /language-(\w+)/.exec(className || '')?.[1] ?? 'text'
                            const isBlock = String(children).includes('\n')
                            if (!isBlock) return <code className={className}>{children}</code>
                            return (
                              <CodeBlock
                                code={String(children).replace(/\n$/, '')}
                                language={lang}
                              />
                            )
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {diagrams[msg.id] && <MermaidBlock code={diagrams[msg.id]} />}
                    </>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <div className="self-start glass-card-static px-4 py-3 flex gap-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div
            className="px-4 pb-4 pt-2 border-t flex-shrink-0"
            style={{ borderColor: 'rgba(72,72,75,0.22)' }}
          >
            <LeonInputBar
              onSend={handleSend}
              disabled={loading}
              voice={voice}
              cancelSpeak={voice.cancelSpeak}
              speaking={voice.speaking}
            />
          </div>
        </LeonStage>

        {/* ── Right panel ───────────────────────────────────────────────── */}
        <RightPanel curriculum={curriculum} sessionId={id} />
      </div>

      {/* ── New session modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showNewModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowNewModal(false)}
          >
            <motion.div
              className="glass-card-static w-full max-w-lg p-8"
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.25 }}
            >
              <h2
                className="text-xl font-light mb-2"
                style={{ color: 'var(--on-surface)' }}
              >
                New learning session
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--on-muted)' }}>
                Describe what you want to learn and I'll generate a curriculum.
              </p>
              <form onSubmit={handleCreateSession} className="flex flex-col gap-4">
                <textarea
                  className="input-base resize-none"
                  rows={4}
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  placeholder="e.g. I want to understand how neural networks work, starting from linear algebra basics."
                  autoFocus
                />
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowNewModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={creatingSession || !newGoal.trim()}
                  >
                    {creatingSession ? (
                      <span className="flex items-center gap-2">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </span>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> Start Session
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── Voice Session Overlay ────────────────────────────────────────── */}
      {showVoiceSession && id && (
        <VoiceSession
          sessionId={id}
          onClose={() => {
            setShowVoiceSession(false)
            sessionsApi.messages(id).then(setMessages).catch(handleApiError)
          }}
        />
      )}
    </div>
  )
}
