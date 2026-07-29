import { useCallback, useEffect, useRef, useState } from 'react'
import { explainApi, ExplainMode, Section, SectionStatus } from '../api/explain'

const POLL_START_MS = 3000
const POLL_MAX_MS = 8000

interface State<T> {
  status: SectionStatus
  content: T | null
  error: string | null
  loading: boolean
}

export function useExplainSection<T = unknown>(repoId: number | null, mode: ExplainMode, section: Section) {
  const [state, setState] = useState<State<T>>({
    status: 'not_started',
    content: null,
    error: null,
    loading: false,
  })
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalMsRef = useRef(POLL_START_MS)
  const stoppedRef = useRef(false)

  const fetchContent = useCallback(async (): Promise<SectionStatus> => {
    if (repoId == null) return 'not_started'
    try {
      const res = await explainApi.section<T>(repoId, mode, section)
      setState({ status: res.status, content: res.content, error: null, loading: false })
      return res.status
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      const status: SectionStatus = detail?.status ?? 'failed'
      setState((prev) => ({ ...prev, status, error: typeof detail === 'string' ? detail : null, loading: false }))
      return status
    }
  }, [repoId, mode, section])

  const poll = useCallback(async () => {
    if (repoId == null || stoppedRef.current) return
    try {
      const statusRes = await explainApi.status(repoId, mode)
      const sectionStatus = statusRes.sections[section]?.status ?? 'not_started'

      if (sectionStatus === 'ready') {
        stoppedRef.current = true
        await fetchContent()
        return
      }
      if (sectionStatus === 'failed') {
        stoppedRef.current = true
        setState({ status: 'failed', content: null, error: statusRes.sections[section]?.error ?? null, loading: false })
        return
      }

      setState((prev) => ({ ...prev, status: sectionStatus, loading: true }))
      intervalMsRef.current = Math.min(intervalMsRef.current + 1000, POLL_MAX_MS)
      timeoutRef.current = setTimeout(poll, intervalMsRef.current)
    } catch {
      // Network error — back off and retry.
      intervalMsRef.current = Math.min(intervalMsRef.current + 1000, POLL_MAX_MS)
      timeoutRef.current = setTimeout(poll, intervalMsRef.current)
    }
  }, [repoId, mode, section, fetchContent])

  const start = useCallback(async () => {
    if (repoId == null) return
    stoppedRef.current = false
    intervalMsRef.current = POLL_START_MS
    setState((prev) => ({ ...prev, loading: true }))
    try {
      await explainApi.start(repoId, mode)
    } catch {
      // Kickoff failed — fall through to polling, which will surface the current state.
    }
    poll()
  }, [repoId, mode, poll])

  useEffect(() => {
    stoppedRef.current = false
    intervalMsRef.current = POLL_START_MS
    fetchContent().then((status) => {
      // If not ready after the initial fetch, kick off polling.
      if (!stoppedRef.current && status !== 'ready' && status !== 'failed') {
        poll()
      }
    })
    return () => {
      stoppedRef.current = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId, mode, section])

  return { ...state, start }
}
