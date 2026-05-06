import api from './api'

export interface UserMemory {
  id: number
  key: string
  value: string
  category: string
  confidence: number
  updatedAt: string
}

export interface KnowledgeNode {
  id: number
  conceptSlug: string
  conceptLabel: string
  mastery: number
  exposures: number
  updatedAt: string
}

export const memoryApi = {
  memories: () => api.get<UserMemory[]>('/api/memory').then((r) => r.data),
  knowledgeGraph: () => api.get<KnowledgeNode[]>('/api/knowledge-graph').then((r) => r.data),
}
