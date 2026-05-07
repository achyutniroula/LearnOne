import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Curriculum } from '../api/sessions'
import { memoryApi, UserMemory, KnowledgeNode } from '../api/memory'
import QuizPanel from './QuizPanel'
import ReviewPanel from './ReviewPanel'
import ProgressPanel from './ProgressPanel'

type Tab = 'curriculum' | 'memory' | 'graph' | 'quiz' | 'progress' | 'review'

const CATEGORY_COLOR: Record<string, string> = {
  struggle: '#ee7d77',
  style: '#64c8ff',
  background: '#c677dd',
  misconception: '#ffc87c',
  preference: '#6ee7b7',
  general: '#767578',
}

interface Props {
  curriculum: Curriculum | null
  sessionId: number | null
}

export default function RightPanel({ curriculum, sessionId }: Props) {
  const [tab, setTab] = useState<Tab>('curriculum')
  const [memories, setMemories] = useState<UserMemory[]>([])
  const [nodes, setNodes] = useState<KnowledgeNode[]>([])

  const fetchMemory = useCallback(() => {
    memoryApi.memories().then(setMemories).catch(() => {})
  }, [])

  const fetchGraph = useCallback(() => {
    memoryApi.knowledgeGraph().then(setNodes).catch(() => {})
  }, [])

  useEffect(() => { fetchMemory(); fetchGraph() }, [fetchMemory, fetchGraph])

  useEffect(() => {
    const handler = () => setTimeout(() => { fetchMemory(); fetchGraph() }, 2000)
    window.addEventListener('chat:turn-complete', handler)
    return () => window.removeEventListener('chat:turn-complete', handler)
  }, [fetchMemory, fetchGraph])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'curriculum', label: 'Plan' },
    { id: 'memory', label: 'Memory' },
    { id: 'graph', label: 'Graph' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'progress', label: 'Progress' },
    { id: 'review', label: 'Review' },
  ]

  return (
    <aside
      className="flex flex-col border-l flex-shrink-0"
      style={{
        width: 240,
        borderColor: 'rgba(255,255,255,0.05)',
        background: 'rgba(17,19,23,0.9)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Tabs — two rows of 3 */}
      <div className="grid grid-cols-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="py-2.5 text-[10px] tracking-widest uppercase transition-all"
            style={{
              color: tab === id ? 'var(--on-surface)' : 'var(--outline)',
              borderBottom: tab === id ? '1px solid rgba(198,198,199,0.4)' : '1px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'curriculum' && (
              curriculum ? (
                <div className="flex flex-col gap-4">
                  <p className="text-xs font-medium" style={{ color: 'var(--on-surface)' }}>{curriculum.title}</p>
                  {curriculum.phases.map((phase, i) => (
                    <div key={i}>
                      <p className="text-xs mb-1.5" style={{ color: 'var(--accent-blue, #64c8ff)' }}>{phase.name}</p>
                      <ul className="flex flex-col gap-1">
                        {phase.topics.map((t, j) => (
                          <li key={j} className="text-xs pl-2" style={{ color: 'var(--on-muted)', borderLeft: '1px solid var(--outline-dim)' }}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--outline)' }}>
                  {sessionId ? 'Generating curriculum…' : 'Start a session to see your plan.'}
                </p>
              )
            )}

            {tab === 'memory' && (
              memories.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--outline)' }}>No memories yet. Keep chatting to build your profile.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {memories.map((m) => (
                    <div key={m.id} className="glass-card p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="badge" style={{
                          background: `${CATEGORY_COLOR[m.category] ?? '#767578'}18`,
                          color: CATEGORY_COLOR[m.category] ?? '#767578',
                          borderColor: `${CATEGORY_COLOR[m.category] ?? '#767578'}30`,
                        }}>
                          {m.category}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--outline)' }}>{m.confidence}%</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--on-muted)' }}>{m.value}</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'graph' && (
              nodes.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--outline)' }}>No concepts tracked yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {nodes.map((n) => (
                    <div key={n.id} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-medium truncate" style={{ color: 'var(--on-surface)' }}>{n.conceptLabel}</span>
                        <span className="text-[10px] ml-1 flex-shrink-0" style={{ color: 'var(--outline)' }}>{n.mastery}%</span>
                      </div>
                      <div className="h-[3px] rounded-full" style={{ background: 'var(--outline-dim)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${n.mastery}%`,
                            background: n.mastery >= 75 ? '#6ee7b7' : n.mastery >= 45 ? '#64c8ff' : '#ee7d77',
                          }}
                        />
                      </div>
                      <span className="text-[10px]" style={{ color: 'var(--outline)' }}>
                        {n.exposures} exposure{n.exposures === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'quiz' && <QuizPanel sessionId={sessionId} />}
            {tab === 'progress' && <ProgressPanel />}
            {tab === 'review' && <ReviewPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  )
}
