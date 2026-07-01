import { useState, useEffect, useRef, FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Plus, LogOut, MessageSquare, Mic, Film } from 'lucide-react'
import clsx from 'clsx'
import { sessionsApi, Session, Message, Curriculum } from '../api/sessions'
import { reposApi } from '../api/repos'
import { useAuth } from '../contexts/AuthContext'
import RightPanel from '../components/RightPanel'
import CodeBlock from '../components/CodeBlock'
import MermaidBlock from '../components/MermaidBlock'
import LeonStage from '../components/leon/LeonStage'
import LeonInputBar from '../components/leon/LeonInputBar'
import VoiceSession from '../components/leon/VoiceSession'
import AnimationPanel from '../components/AnimationPanel'
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
  const [curriculumTimedOut, setCurriculumTimedOut] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newRepoUrl, setNewRepoUrl] = useState('')
  const [creatingSession, setCreatingSession] = useState(false)
  // Indexing progress state — set after session create when repo isn't ready yet
  const [pendingSessionId, setPendingSessionId] = useState<number | null>(null)
  const [indexingRepoId, setIndexingRepoId] = useState<number | null>(null)
  const [indexingStatus, setIndexingStatus] = useState<string | null>(null)
  const [indexingFileCount, setIndexingFileCount] = useState<number | null>(null)
  const [indexingChunkCount, setIndexingChunkCount] = useState<number | null>(null)
  const [indexingError, setIndexingError] = useState<string | null>(null)
  const [diagrams, setDiagrams] = useState<DiagramMap>({})
  const [showVoiceSession, setShowVoiceSession] = useState(false)
  // Holds the session ID to pass to VoiceSession — may differ from the URL param
  // when a LEON Voice session is auto-created from the no-session state.
  const [voiceSessionId, setVoiceSessionId] = useState<number | null>(null)
  const [showAnimation, setShowAnimation] = useState(false)
  const [animationSessionId, setAnimationSessionId] = useState<number | null>(null)
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
    setCurriculum(null)
    setCurriculumTimedOut(false)
  }, [id])

  // ── Poll curriculum until the async generator has produced one ─────────
  // Gives up after ~2 minutes in case backend generation failed silently.
  useEffect(() => {
    if (!id || curriculum) return

    let cancelled = false
    let attempts = 0
    const MAX_ATTEMPTS = 30

    const poll = () => {
      attempts += 1
      sessionsApi.curriculum(id).then((c) => {
        if (!cancelled) setCurriculum(c)
      }).catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status !== 404) {
          handleApiError(err)
          return
        }
        if (attempts >= MAX_ATTEMPTS && !cancelled) {
          clearInterval(interval)
          setCurriculumTimedOut(true)
        }
      })
    }

    poll()
    const interval = setInterval(poll, 4000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [id, curriculum])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Poll indexing status ───────────────────────────────────────────────
  useEffect(() => {
    if (!indexingRepoId) return
    if (indexingStatus === 'ready' || indexingStatus === 'failed') return

    const interval = setInterval(async () => {
      try {
        const data = await reposApi.status(indexingRepoId)
        setIndexingStatus(data.status)
        setIndexingFileCount(data.fileCount)
        setIndexingChunkCount(data.chunkCount)
        if (data.status === 'failed') {
          setIndexingError(data.errorMessage ?? 'Indexing failed.')
        }
        if (data.status === 'ready') {
          clearInterval(interval)
          setShowNewModal(false)
          setIndexingRepoId(null)
          setIndexingStatus(null)
          if (pendingSessionId) navigate(`/chat/${pendingSessionId}`)
        }
      } catch { /* network blip — keep polling */ }
    }, 3000)

    return () => clearInterval(interval)
  }, [indexingRepoId, indexingStatus, pendingSessionId])

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
    if (!newRepoUrl.trim()) return
    setCreatingSession(true)
    setIndexingError(null)
    try {
      const session = await sessionsApi.create(newRepoUrl.trim())
      setSessions((prev) => [session, ...prev])
      setNewRepoUrl('')

      if (!session.repoId || session.repoStatus === 'ready') {
        // Repo already indexed or no repo (LEON Voice) — navigate immediately
        setShowNewModal(false)
        navigate(`/chat/${session.id}`)
      } else {
        // Indexing in progress — stay in modal, start polling
        setPendingSessionId(session.id)
        setIndexingRepoId(session.repoId)
        setIndexingStatus(session.repoStatus ?? 'pending')
        setIndexingFileCount(null)
        setIndexingChunkCount(null)
      }
    } catch {
      setIndexingError('Failed to create session. Please try again.')
    } finally {
      setCreatingSession(false)
    }
  }

  function handleDismissModal() {
    setShowNewModal(false)
    setIndexingRepoId(null)
    setIndexingStatus(null)
    setIndexingError(null)
    setPendingSessionId(null)
    // If indexing was in progress, navigate to the session anyway (will work once ready)
    if (pendingSessionId) navigate(`/chat/${pendingSessionId}`)
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
            onClick={async () => {
              if (id) {
                setVoiceSessionId(id)
                setShowVoiceSession(true)
              } else {
                // Auto-create a LEON Voice session so the user can speak immediately
                // without having to select a repo first.
                setCreatingSession(true)
                try {
                  const session = await sessionsApi.create('LEON Voice')
                  // 'LEON Voice' is the sentinel for an unattached voice session
                  setSessions((prev) => [session, ...prev])
                  setVoiceSessionId(session.id)
                  setShowVoiceSession(true)
                  navigate(`/chat/${session.id}`)
                } catch {
                  setShowNewModal(true)
                } finally {
                  setCreatingSession(false)
                }
              }
            }}
            disabled={creatingSession}
            className="btn-primary w-full flex items-center gap-2"
            style={{ background: 'rgba(100,200,255,0.07)', borderColor: 'rgba(100,200,255,0.25)' }}
          >
            <Mic className="w-3.5 h-3.5" />
            {creatingSession ? 'Starting…' : 'Talk to LEON'}
          </button>
          <button
            onClick={() => {
              if (id) {
                setAnimationSessionId(id)
                setShowAnimation(true)
              }
            }}
            disabled={!id}
            className="btn-ghost w-full flex items-center gap-2"
            style={{ opacity: id ? 1 : 0.4 }}
          >
            <Film className="w-3.5 h-3.5" />
            Explore Explainer
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="btn-ghost w-full flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Explore Repo
          </button>
        </div>
        <div className="mx-4 h-px" style={{ background: 'rgba(72,72,75,0.3)' }} />

        <div className="flex-1 overflow-y-auto no-scrollbar py-2">
          {sessions.length === 0 && (
            <p className="px-6 text-xs" style={{ color: 'var(--outline)' }}>
              No repos yet. Add one to get started.
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
        <RightPanel curriculum={curriculum} sessionId={id} curriculumTimedOut={curriculumTimedOut} />
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
            onClick={(e) => e.target === e.currentTarget && handleDismissModal()}
          >
            <motion.div
              className="glass-card-static w-full max-w-lg p-8"
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.25 }}
            >
              {/* ── Indexing progress view ─────────────────────────────── */}
              {indexingRepoId && indexingStatus !== 'failed' ? (
                <div className="flex flex-col items-center gap-6 py-4">
                  <div className="flex gap-1">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-light mb-1" style={{ color: 'var(--on-surface)' }}>
                      {indexingStatus === 'fetching' && 'Fetching repository files…'}
                      {indexingStatus === 'indexing' && (
                        indexingFileCount
                          ? `Indexing ${indexingFileCount} files…`
                          : 'Indexing files…'
                      )}
                      {indexingStatus === 'pending' && 'Preparing…'}
                      {(!indexingStatus || indexingStatus === 'ready') && 'Almost ready…'}
                    </p>
                    {indexingChunkCount != null && (
                      <p className="text-xs" style={{ color: 'var(--on-muted)' }}>
                        {indexingChunkCount} chunks embedded
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={handleDismissModal}
                  >
                    Continue in background
                  </button>
                </div>
              ) : (
                <>
                  <h2
                    className="text-xl font-light mb-2"
                    style={{ color: 'var(--on-surface)' }}
                  >
                    Explore a GitHub repo
                  </h2>
                  <p className="text-sm mb-6" style={{ color: 'var(--on-muted)' }}>
                    Paste a public GitHub repo URL and LEON will generate a structured overview.
                  </p>

                  {indexingError && (
                    <p className="text-xs mb-4 px-1" style={{ color: 'var(--error)' }}>
                      {indexingError}
                    </p>
                  )}

                  <form onSubmit={handleCreateSession} className="flex flex-col gap-4">
                    <input
                      className="input-base"
                      type="url"
                      value={newRepoUrl}
                      onChange={(e) => setNewRepoUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      autoFocus
                    />
                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={handleDismissModal}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={creatingSession || !newRepoUrl.trim()}
                      >
                        {creatingSession ? (
                          <span className="flex items-center gap-2">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </span>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" /> Start Exploring
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── Voice Session Overlay ────────────────────────────────────────── */}
      {showVoiceSession && voiceSessionId && (
        <VoiceSession
          sessionId={voiceSessionId}
          onClose={() => {
            setShowVoiceSession(false)
            setVoiceSessionId(null)
            if (id) sessionsApi.messages(id).then(setMessages).catch(handleApiError)
          }}
        />
      )}
      {/* ── Animation Panel Overlay ──────────────────────────────────────── */}
      {showAnimation && animationSessionId && (
        <AnimationPanel
          sessionId={animationSessionId}
          onClose={() => setShowAnimation(false)}
        />
      )}
    </div>
  )
}
