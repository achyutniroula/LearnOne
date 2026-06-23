import api from './api'

export interface RepoStatus {
  repoId: number
  status: 'pending' | 'fetching' | 'indexing' | 'ready' | 'failed'
  fileCount: number | null
  chunkCount: number | null
  errorMessage: string | null
}

export const reposApi = {
  status: (repoId: number) =>
    api.get<RepoStatus>(`/api/repos/${repoId}/status`).then((r) => r.data),
}
