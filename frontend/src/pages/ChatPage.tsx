import { useState, useEffect, useRef, FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { sessionsApi, Session, Message, Curriculum } from '../api/sessions'
import { useAuth } from '../contexts/AuthContext'

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCurriculum, setShowCurriculum] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newGoal, setNewGoal] = useState('')
  const [creatingSession, setCreatingSession] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

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

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!input.trim() || !id || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { id: Date.now(), role: 'USER', content: userMsg, createdAt: new Date().toISOString() }])
    setLoading(true)
    try {
      const reply = await sessionsApi.chat(id, userMsg)
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'ASSISTANT', content: reply.content, createdAt: new Date().toISOString() }])
    } catch {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'ASSISTANT', content: '_Error: could not reach the server. Please try again._', createdAt: new Date().toISOString() }])
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
      alert('Failed to create session. Please try again.')
    } finally {
      setCreatingSession(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const activeSession = sessions.find((s) => s.id === id)

  return (
    <div style={s.root}>
      {/* Left sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <span style={s.logo}>LearnOne</span>
          <button style={s.newBtn} onClick={() => setShowNewModal(true)}>+ New</button>
        </div>
        <div style={s.sessionList}>
          {sessions.map((sess) => (
            <button
              key={sess.id}
              style={{ ...s.sessionItem, ...(sess.id === id ? s.sessionItemActive : {}) }}
              onClick={() => navigate(`/chat/${sess.id}`)}
            >
              {sess.title || sess.learningGoal}
            </button>
          ))}
          {sessions.length === 0 && <p style={s.emptyText}>No sessions yet. Create one!</p>}
        </div>
        <button style={s.logoutBtn} onClick={handleLogout}>Logout</button>
      </aside>

      {/* Main chat */}
      <main style={s.main}>
        {!id ? (
          <div style={s.placeholder}>
            <h2 style={{ color: '#fff' }}>Select a session or create a new one.</h2>
            <button style={s.bigBtn} onClick={() => setShowNewModal(true)}>Start Learning</button>
          </div>
        ) : (
          <>
            <div style={s.chatHeader}>
              <span style={s.chatTitle}>{activeSession?.learningGoal ?? 'Session'}</span>
              <button style={s.toggleCurriculum} onClick={() => setShowCurriculum((v) => !v)}>
                {showCurriculum ? 'Hide Curriculum' : 'Show Curriculum'}
              </button>
            </div>
            <div style={s.messages}>
              {messages.map((msg) => (
                <div key={msg.id} style={msg.role === 'USER' ? s.userBubble : s.aiBubble}>
                  {msg.role === 'ASSISTANT' ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
              ))}
              {loading && <div style={s.aiBubble}><em style={{ color: '#888' }}>LearOne is thinking…</em></div>}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={handleSend} style={s.inputRow}>
              <input
                style={s.textInput}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything…"
                disabled={loading}
                autoFocus
              />
              <button style={s.sendBtn} type="submit" disabled={loading || !input.trim()}>Send</button>
            </form>
          </>
        )}
      </main>

      {/* Curriculum panel */}
      {id && showCurriculum && (
        <aside style={s.curriculum}>
          <h3 style={s.curriculumTitle}>Curriculum</h3>
          {curriculum ? (
            <>
              <p style={s.curriculumHeading}>{curriculum.title}</p>
              {curriculum.phases.map((phase, i) => (
                <div key={i} style={s.phase}>
                  <strong style={{ color: '#a5b4fc' }}>{phase.name}</strong>
                  <ul style={s.topicList}>
                    {phase.topics.map((t, j) => <li key={j}>{t}</li>)}
                  </ul>
                </div>
              ))}
            </>
          ) : (
            <p style={s.emptyText}>Generating curriculum…</p>
          )}
        </aside>
      )}

      {/* New session modal */}
      {showNewModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h2 style={{ color: '#fff', marginTop: 0 }}>What do you want to learn?</h2>
            <form onSubmit={handleCreateSession}>
              <textarea
                style={s.goalInput}
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="e.g. I want to understand how neural networks work, starting from basic linear algebra."
                rows={4}
                autoFocus
              />
              <div style={s.modalActions}>
                <button type="button" style={s.cancelBtn} onClick={() => setShowNewModal(false)}>Cancel</button>
                <button type="submit" style={s.bigBtn} disabled={creatingSession || !newGoal.trim()}>
                  {creatingSession ? 'Creating…' : 'Start Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', height: '100vh', background: '#0f0f0f', color: '#e5e5e5', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: 240, borderRight: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  sidebarHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #2a2a2a' },
  logo: { fontWeight: 700, color: '#6366f1', fontSize: '1rem' },
  newBtn: { padding: '0.3rem 0.7rem', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' },
  sessionList: { flex: 1, overflowY: 'auto', padding: '0.5rem' },
  sessionItem: { display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.8rem', borderRadius: 6, border: 'none', background: 'transparent', color: '#ccc', cursor: 'pointer', marginBottom: 2, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sessionItemActive: { background: '#1e1e2e', color: '#a5b4fc' },
  logoutBtn: { margin: '0.75rem', padding: '0.5rem', borderRadius: 6, border: '1px solid #333', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.85rem' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  chatHeader: { padding: '0.75rem 1rem', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  chatTitle: { fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  toggleCurriculum: { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #333', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 },
  messages: { flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  userBubble: { alignSelf: 'flex-end', background: '#4f46e5', color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '0.6rem 1rem', maxWidth: '70%' },
  aiBubble: { alignSelf: 'flex-start', background: '#1a1a2e', borderRadius: '12px 12px 12px 2px', padding: '0.6rem 1rem', maxWidth: '80%', lineHeight: 1.6 },
  inputRow: { display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid #2a2a2a' },
  textInput: { flex: 1, padding: '0.65rem 1rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', fontSize: '0.95rem' },
  sendBtn: { padding: '0.65rem 1.2rem', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600 },
  curriculum: { width: 220, borderLeft: '1px solid #2a2a2a', overflowY: 'auto', padding: '1rem', flexShrink: 0 },
  curriculumTitle: { color: '#a5b4fc', marginTop: 0, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  curriculumHeading: { color: '#fff', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem' },
  phase: { marginBottom: '1rem' },
  topicList: { margin: '0.25rem 0 0 1rem', padding: 0, color: '#aaa', fontSize: '0.82rem', lineHeight: 1.6 },
  emptyText: { color: '#555', fontSize: '0.85rem' },
  placeholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '1rem' },
  bigBtn: { padding: '0.75rem 1.5rem', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 500 },
  goalInput: { width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box' },
  modalActions: { display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' },
  cancelBtn: { padding: '0.65rem 1rem', borderRadius: 8, border: '1px solid #333', background: 'transparent', color: '#888', cursor: 'pointer' },
}
