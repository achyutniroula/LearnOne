import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { reposApi, RepoStatus } from '../api/repos'
import { explainApi, ExplainMode } from '../api/explain'
import ProgressBar from '../components/ProgressBar'

const MODES: { id: ExplainMode; title: string; description: string }[] = [
  { id: 'noobie', title: 'Noobie', description: 'Plain-English, no jargon, everyday analogies.' },
  { id: 'normal', title: 'Normal', description: 'Standard technical vocabulary, concise and precise.' },
]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const MAX_INDEX_POLLS = 120 // ~5 min at 2.5s intervals

interface ProgressInfo {
  percent: number | null
  label: string
}

function progressFromStatus(status: RepoStatus): ProgressInfo {
  if (status.status === 'pending') {
    return { percent: null, label: 'Queued…' }
  }
  if (status.status === 'fetching') {
    return { percent: null, label: 'Fetching repository files…' }
  }
  if (status.status === 'indexing') {
    if (status.totalChunks && status.totalChunks > 0) {
      const done = status.chunkCount ?? 0
      const percent = Math.round((done / status.totalChunks) * 100)
      return { percent, label: `Indexing… ${done}/${status.totalChunks} chunks embedded` }
    }
    return { percent: null, label: `Preparing ${status.fileCount ?? ''} files for indexing…` }
  }
  return { percent: 100, label: 'Indexed.' }
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<ExplainMode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)

  const canSubmit = url.trim().length > 0 && mode !== null && !loading
  const unmountedRef = useRef(false)
  useEffect(() => {
    // In React 18 StrictMode (dev only), effects run mount -> cleanup -> mount.
    // Resetting on mount (not just setting true on cleanup) keeps this flag in
    // sync with whether the component is *actually* mounted right now.
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])

  const submit = useCallback(async () => {
    if (!canSubmit || !mode) return
    setLoading(true)
    setError(null)
    try {
      let status = await reposApi.index(url.trim())
      setProgress(progressFromStatus(status))

      let polls = 0
      while (
        (status.status === 'pending' || status.status === 'fetching' || status.status === 'indexing') &&
        polls < MAX_INDEX_POLLS
      ) {
        await sleep(2500)
        if (unmountedRef.current) return
        status = await reposApi.status(status.repoId)
        if (unmountedRef.current) return
        setProgress(progressFromStatus(status))
        polls += 1
      }
      if (unmountedRef.current) return

      if (status.status !== 'ready') {
        setError(
          polls >= MAX_INDEX_POLLS
            ? 'Indexing is taking longer than expected. Please try again later.'
            : status.errorMessage || 'Failed to index this repository.'
        )
        setLoading(false)
        return
      }

      setProgress({ percent: null, label: 'Starting explainer…' })
      await explainApi.start(status.repoId, mode)
      if (unmountedRef.current) return

      navigate(`/repo/${status.repoId}?mode=${mode}`)
    } catch (err: any) {
      if (unmountedRef.current) return
      setError(err?.response?.data?.detail || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }, [canSubmit, mode, url, navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="max-w-xl w-full text-center">
        <h1 className="text-3xl font-light mb-3" style={{ color: 'var(--on-surface)' }}>
          Understand any GitHub repo
        </h1>
        <p className="text-sm mb-10" style={{ color: 'var(--on-muted)' }}>
          Paste a repository URL and get a clear, book-style explanation of how it works.
        </p>

        <input
          className="input-base mb-6"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />

        <div className="grid grid-cols-2 gap-3 mb-8">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              disabled={loading}
              className="glass-card-static p-4 text-left"
              style={{
                borderColor: mode === m.id ? 'var(--glass-border-h)' : undefined,
                boxShadow: mode === m.id ? '0 0 0 1px var(--primary)' : undefined,
              }}
            >
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--on-surface)' }}>
                {m.title}
              </div>
              <div className="text-xs" style={{ color: 'var(--on-muted)' }}>
                {m.description}
              </div>
            </button>
          ))}
        </div>

        <button className="btn-primary w-full" disabled={!canSubmit} onClick={submit}>
          {loading ? 'Working…' : 'Explain this repo'}
        </button>

        {loading && progress && (
          <div className="mt-6">
            <ProgressBar percent={progress.percent} label={progress.label} />
          </div>
        )}

        {error && (
          <p className="text-sm mt-4" style={{ color: 'var(--error)' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
