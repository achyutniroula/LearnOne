import api from './api'

export interface QuizQuestion {
  id: number
  question: string
  type: 'MCQ' | 'SHORT_ANSWER'
  choices?: string[]
  correctAnswer: string
  explanation?: string
}

export interface Quiz {
  id: number
  questions: QuizQuestion[]
}

export const quizApi = {
  generate: (sessionId: number) =>
    api.post<Quiz>(`/api/sessions/${sessionId}/quiz`).then((r) => r.data),
  get: (sessionId: number) =>
    api.get<Quiz>(`/api/sessions/${sessionId}/quiz`).then((r) => r.data),
}
