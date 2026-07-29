import api from './api'

export interface RepoStatus {
  repoId: number
  status: 'pending' | 'fetching' | 'indexing' | 'ready' | 'failed'
  fileCount: number | null
  totalChunks: number | null
  chunkCount: number | null
  errorMessage: string | null
}

export const reposApi = {
  index: (repoUrl: string) =>
    api.post<RepoStatus>('/api/repos/index', { repo_url: repoUrl }).then((r) => r.data),
  status: (repoId: number) =>
    api.get<RepoStatus>(`/api/repos/${repoId}/status`).then((r) => r.data),
}
