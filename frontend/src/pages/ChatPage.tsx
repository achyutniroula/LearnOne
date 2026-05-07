import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Plus, LogOut, MessageSquare, Paperclip, Send, X } from 'lucide-react'
import clsx from 'clsx'
import { sessionsApi, Session, Message, Curriculum } from '../api/sessions'
import { useAuth } from '../contexts/AuthContext'
import RightPanel from '../components/RightPanel'
import CodeBlock from '../components/CodeBlock'
import MermaidBlock from '../components/MermaidBlock'
import 'katex/dist/katex.min.css'

const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

interface PendingImage { data: string; mediaType: string; preview: string }
interface DiagramMap { [msgId: number]: string }

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newGoal, setNewGoal] = useState('')
  const [creatingSession, setCreatingSession] = useState(false)
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [diagrams, setDiagrams] = useState<DiagramMap>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const id = sessionId ? parseInt(sessionId) : null

  useEffect(() => {
    sessionsApi.list().then(setSessions).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    sessionsApi.messages(id).then(setMessages).catch(() => {})
    sessionsApi.curriculum(id).then(setCurriculum).catch(() => {})
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setImageError(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) { setImageError('Use JPEG, PNG, GIF, or WebP.'); return }
    if (file.size > MAX_IMAGE_BYTES) { setImageError('Image must be under 3 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setPendingImage({ data: dataUrl.split(',')[1], mediaType: file.type, preview: dataUrl })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!input.trim() || !id || loading) return
    const userMsg = input.trim()
    const img = pendingImage
    setInput('')
    setPendingImage(null)
    setMessages((prev) => [...prev, { id: Date.now(), role: 'USER', content: userMsg, imageData: img?.data, imageMediaType: img?.mediaType, createdAt: new Date().toISOString() }])
    setLoading(true)
    try {
      const reply = await sessionsApi.chat(id, userMsg, img?.data, img?.mediaType)
      const aiId = Date.now() + 1
      setMessages((prev) => [...prev, { id: aiId, role: 'ASSISTANT', content: reply.content, createdAt: new Date().toISOString() }])
      if (reply.diagramCode) setDiagrams((prev) => ({ ...prev, [aiId]: reply.diagramCode! }))
      window.dispatchEvent(new Event('chat:turn-complete'))
    } catch {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'ASSISTANT', content: '_Error: could not reach the server._', createdAt: new Date().toISOString() }])
    } finally {
      setLoading(false)
    }
  }

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

      {/* ── Navbar ───────────────────────────────────────────────── */}
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
        <span className="text-base tracking-[0.2em] uppercase font-light select-none" style={{ color: 'var(--on-surface)' }}>
          Learn<span className="rgb-text-gradient font-normal">One</span>
        </span>
        {activeSession && (
          <span className="text-xs truncate max-w-xs hidden md:block" style={{ color: 'var(--on-muted)' }}>
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
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(to right, transparent, rgba(100,200,255,0.25), rgba(198,119,221,0.2), rgba(0,255,200,0.15), transparent)' }}
        />
      </nav>

      {/* ── Left Sidebar (sessions) ──────────────────────────────── */}
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
        <div className="p-4">
          <button
            onClick={() => setShowNewModal(true)}
            className="btn-primary w-full flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            New Session
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar py-2">
          {sessions.length === 0 && (
            <p className="px-6 text-xs" style={{ color: 'var(--outline)' }}>No sessions yet.</p>
          )}
          {sessions.map((sess) => {
            const active = sess.id === id
            return (
              <button
                key={sess.id}
                onClick={() => navigate(`/chat/${sess.id}`)}
                className={clsx(
                  'flex items-center gap-3 w-full px-6 py-3 text-left text-sm transition-all',
                  active ? 'text-[#e2e2e8] bg-white/[0.04]' : 'text-[#c6c6c7]/40 hover:text-[#c6c6c7] hover:bg-[#1e2024]'
                )}
                style={active ? { borderLeft: '2px solid rgba(198,198,199,0.6)' } : { borderLeft: '2px solid transparent' }}
              >
                <MessageSquare className={clsx('w-3.5 h-3.5 flex-shrink-0', active ? 'text-[#c6c6c8]' : 'opacity-40')} />
                <span className="truncate font-light">{sess.title || sess.learningGoal}</span>
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── Main layout (sidebar offset) ────────────────────────── */}
      <div className="flex flex-1 md:ml-64 mt-[57px] min-w-0">

        {/* ── Chat area ──────────────────────────────────────────── */}
        <main className="flex flex-col flex-1 min-w-0">
          {!id ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-6 px-4">
              <div className="orb-blue" /><div className="orb-purple" />
              <motion.div className="text-center relative z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="text-2xl font-light tracking-wide mb-2" style={{ color: 'var(--on-surface)' }}>
                  What do you want to <span className="rgb-text-gradient">learn</span> today?
                </h2>
                <p className="text-sm mb-8" style={{ color: 'var(--on-muted)' }}>Start a session and I'll build a personalised curriculum for you.</p>
                <button onClick={() => setShowNewModal(true)} className="btn-primary">
                  <Plus className="w-4 h-4" /> Start Learning
                </button>
              </motion.div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
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
                      style={msg.role === 'USER' ? {
                        background: 'rgba(198,198,200,0.09)',
                        border: '1px solid rgba(198,198,200,0.15)',
                        color: 'var(--on-surface)',
                      } : {
                        color: 'var(--on-surface)',
                      }}
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
                                const lang = /language-(\w+)/.exec(className || '')?.[1] ?? 'text'
                                const isBlock = String(children).includes('\n')
                                if (!isBlock) return <code className={className}>{children}</code>
                                return <CodeBlock code={String(children).replace(/\n$/, '')} language={lang} />
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
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Image preview */}
              {pendingImage && (
                <div className="flex items-center gap-3 px-6 py-2 border-t" style={{ borderColor: 'rgba(72,72,75,0.22)', background: 'var(--surface-low)' }}>
                  <img src={pendingImage.preview} alt="preview" className="h-12 w-12 object-cover rounded-lg" />
                  <span className="text-xs flex-1 truncate" style={{ color: 'var(--on-muted)' }}>{pendingImage.mediaType}</span>
                  <button onClick={() => setPendingImage(null)} className="btn-ghost p-1.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {imageError && (
                <p className="px-6 py-1 text-xs" style={{ color: 'var(--error)' }}>{imageError}</p>
              )}

              {/* Input */}
              <div className="px-6 py-4 border-t" style={{ borderColor: 'rgba(72,72,75,0.22)' }}>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleFileChange} />
                <form onSubmit={handleSend} className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => { setImageError(null); fileInputRef.current?.click() }}
                    className="btn-ghost p-2.5 flex-shrink-0"
                    title="Attach image"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    className="input-base"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything…"
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="btn-primary px-4 py-2.5 flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </main>

        {/* ── Right panel ─────────────────────────────────────────── */}
        <RightPanel curriculum={curriculum} sessionId={id} />
      </div>

      {/* ── New session modal ─────────────────────────────────────── */}
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
              <h2 className="text-xl font-light mb-2" style={{ color: 'var(--on-surface)' }}>New learning session</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--on-muted)' }}>Describe what you want to learn and I'll generate a curriculum.</p>
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
                  <button type="button" className="btn-ghost" onClick={() => setShowNewModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={creatingSession || !newGoal.trim()}>
                    {creatingSession ? (
                      <span className="flex items-center gap-2">
                        <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                      </span>
                    ) : (
                      <><Plus className="w-3.5 h-3.5" /> Start Session</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
