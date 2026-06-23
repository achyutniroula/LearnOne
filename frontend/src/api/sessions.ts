import api from './api'

export interface Session {
  id: number
  title: string
  learningGoal: string
  repoUrl?: string
  repoId?: number
  repoStatus?: string
  status: string
  createdAt: string
}

export interface Message {
  id: number
  role: 'USER' | 'ASSISTANT'
  content: string
  imageData?: string
  imageMediaType?: string
  createdAt: string
}

export interface CurriculumPhase {
  name: string
  topics: string[]
}

export interface Curriculum {
  title: string
  phases: CurriculumPhase[]
}

export const sessionsApi = {
  create: (repoUrl: string) =>
    api.post<Session>('/api/sessions', { repoUrl }).then((r) => r.data),

  list: () => api.get<Session[]>('/api/sessions').then((r) => r.data),

  messages: (sessionId: number) =>
    api.get<Message[]>(`/api/sessions/${sessionId}/messages`).then((r) => r.data),

  chat: (sessionId: number, message: string, imageData?: string, imageMediaType?: string) =>
    api
      .post<{ role: string; content: string; diagramCode?: string }>(`/api/sessions/${sessionId}/chat`, {
        message,
        ...(imageData ? { imageData, imageMediaType } : {}),
      })
      .then((r) => r.data),

  curriculum: (sessionId: number) =>
    api.get<Curriculum>(`/api/sessions/${sessionId}/curriculum`).then((r) => r.data),
}
