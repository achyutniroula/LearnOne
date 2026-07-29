import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { explainApi, ExplainMode, Section } from '../api/explain'
import { useExplainSection } from '../hooks/useExplainSection'
import TabShell from '../components/explainer/TabShell'
import PrefaceTab, { PrefaceContent } from '../components/explainer/PrefaceTab'
import ContentsTab, { ContentsContent } from '../components/explainer/ContentsTab'
import PipelineTab, { PipelineContent } from '../components/explainer/PipelineTab'
import IndepthTab, { IndepthContent } from '../components/explainer/IndepthTab'

const TABS: { id: Section; label: string }[] = [
  { id: 'preface', label: 'Preface' },
  { id: 'contents', label: 'Contents' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'indepth', label: 'In-Depth' },
]

export default function ExplainerPage() {
  const { repoId: repoIdParam } = useParams<{ repoId: string }>()
  const repoId = repoIdParam ? Number(repoIdParam) : null
  const [searchParams, setSearchParams] = useSearchParams()
  const modeParam = (searchParams.get('mode') as ExplainMode) || 'normal'
  const [mode, setMode] = useState<ExplainMode>(modeParam)
  const [activeTab, setActiveTab] = useState<Section>('preface')

  useEffect(() => {
    setSearchParams({ mode }, { replace: true })
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure generation has been kicked off for the current mode.
  useEffect(() => {
    if (repoId == null) return
    let cancelled = false
    explainApi.status(repoId, mode).then((res) => {
      if (cancelled) return
      const notStarted = Object.values(res.sections).some((s) => s.status === 'not_started')
      if (res.overall === 'not_started' || notStarted) {
        explainApi.start(repoId, mode).catch(() => {})
      }
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [repoId, mode])

  const preface = useExplainSection<PrefaceContent>(repoId, mode, 'preface')
  const contents = useExplainSection<ContentsContent>(repoId, mode, 'contents')
  const pipeline = useExplainSection<PipelineContent>(repoId, mode, 'pipeline')
  const indepth = useExplainSection<IndepthContent>(repoId, mode, 'indepth')

  const sections = useMemo(
    () => ({ preface, contents, pipeline, indepth }),
    [preface, contents, pipeline, indepth],
  )

  if (repoId == null) return null

  const active = sections[activeTab]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-10 border-b" style={{ borderColor: 'var(--outline-faint)', background: 'var(--bg)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="btn-ghost"
                style={{
                  borderColor: activeTab === t.id ? 'var(--glass-border-h)' : undefined,
                  color: activeTab === t.id ? 'var(--on-surface)' : undefined,
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--outline)' }}>
            <span>Mode</span>
            <button
              className="btn-ghost"
              onClick={() => setMode(mode === 'noobie' ? 'normal' : 'noobie')}
            >
              {mode === 'noobie' ? 'Noobie' : 'Normal'}
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-10">
        <TabShell status={active.status} error={active.error} onRetry={() => active.start()}>
          {activeTab === 'preface' && preface.content && <PrefaceTab content={preface.content} />}
          {activeTab === 'contents' && contents.content && <ContentsTab content={contents.content} />}
          {activeTab === 'pipeline' && pipeline.content && <PipelineTab content={pipeline.content} />}
          {activeTab === 'indepth' && indepth.content && <IndepthTab content={indepth.content} />}
        </TabShell>
      </main>
    </div>
  )
}
