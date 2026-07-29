import api from './api'

export type ExplainMode = 'noobie' | 'normal'
export type Section = 'preface' | 'contents' | 'pipeline' | 'indepth'

export type SectionStatus = 'not_started' | 'pending' | 'generating' | 'ready' | 'failed'

export interface ExplainKickoffResponse {
  status: 'pending' | 'ready'
  repoId: number
  mode: ExplainMode
  queued: Section[]
}

export interface ExplainStatusResponse {
  repoId: number
  mode: ExplainMode
  overall: 'not_started' | 'pending' | 'ready' | 'failed'
  sections: Record<Section, { status: SectionStatus; error: string | null }>
}

export interface ExplainSectionResponse<T = unknown> {
  repoId: number
  mode: ExplainMode
  section: Section
  status: SectionStatus
  content: T | null
  generatedAt: string | null
}

export const explainApi = {
  start: (repoId: number, mode: ExplainMode) =>
    api.post<ExplainKickoffResponse>(`/api/repos/${repoId}/explain`, { mode }).then((r) => r.data),
  status: (repoId: number, mode: ExplainMode) =>
    api.get<ExplainStatusResponse>(`/api/repos/${repoId}/explain/status`, { params: { mode } }).then((r) => r.data),
  section: <T = unknown>(repoId: number, mode: ExplainMode, section: Section) =>
    api.get<ExplainSectionResponse<T>>(`/api/repos/${repoId}/explain/${section}`, { params: { mode } }).then((r) => r.data),
}

export function startExplain(repoId: number, mode: ExplainMode) {
  return explainApi.start(repoId, mode)
}

export function getExplainStatus(repoId: number, mode: ExplainMode) {
  return explainApi.status(repoId, mode)
}

export function getExplainSection<T = unknown>(repoId: number, mode: ExplainMode, section: Section) {
  return explainApi.section<T>(repoId, mode, section)
}
