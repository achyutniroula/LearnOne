import api from './api'

export interface Progress {
  totalConcepts: number
  masteredCount: number
  learningCount: number
  strugglingCount: number
  averageMastery: number
  reviewsDue: number
}

export const progressApi = {
  get: () => api.get<Progress>('/api/progress').then((r) => r.data),
}
