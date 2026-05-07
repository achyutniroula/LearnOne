import api from './api'

export interface ReviewDue {
  conceptSlug: string
  conceptLabel: string
  intervalDays: number
  repetitions: number
  nextReviewAt: string
}

export const reviewApi = {
  getDue: () => api.get<ReviewDue[]>('/api/review/due').then((r) => r.data),
  record: (slug: string, quality: number) =>
    api.post(`/api/review/${slug}/record`, { quality }).then((r) => r.data),
}
