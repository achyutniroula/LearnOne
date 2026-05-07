import { useState } from 'react'
import { Quiz, QuizQuestion, quizApi } from '../api/quiz'
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

interface Props { sessionId: number | null }

export default function QuizPanel({ sessionId }: Props) {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)

  async function load() {
    if (!sessionId) return
    setLoading(true)
    setAnswers({})
    setSubmitted(false)
    try {
      const q = await quizApi.generate(sessionId)
      setQuiz(q)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  function score() {
    if (!quiz) return 0
    return quiz.questions.filter((q) => answers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()).length
  }

  if (!sessionId) return (
    <p className="text-xs" style={{ color: 'var(--outline)' }}>Start a session to generate a quiz.</p>
  )

  if (!quiz) return (
    <button onClick={load} disabled={loading} className="btn-primary w-full text-xs">
      {loading ? 'Generating…' : 'Generate Quiz'}
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      {submitted && (
        <div className="glass-card p-3 text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--on-surface)' }}>
            {score()} / {quiz.questions.length}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--on-muted)' }}>
            {score() === quiz.questions.length ? 'Perfect!' : 'Keep going!'}
          </p>
        </div>
      )}

      {quiz.questions.map((q) => (
        <QuestionCard
          key={q.id}
          question={q}
          answer={answers[q.id] ?? ''}
          submitted={submitted}
          onChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))}
        />
      ))}

      <div className="flex gap-2">
        {!submitted ? (
          <button
            className="btn-primary flex-1 text-xs"
            onClick={() => setSubmitted(true)}
            disabled={Object.keys(answers).length < quiz.questions.length}
          >
            Submit
          </button>
        ) : (
          <button className="btn-ghost flex-1 text-xs flex items-center justify-center gap-1" onClick={load}>
            <RefreshCw className="w-3 h-3" /> New Quiz
          </button>
        )}
      </div>
    </div>
  )
}

function QuestionCard({ question, answer, submitted, onChange }: {
  question: QuizQuestion
  answer: string
  submitted: boolean
  onChange: (v: string) => void
}) {
  const correct = answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()

  return (
    <div className="glass-card p-3 flex flex-col gap-2">
      <p className="text-xs leading-relaxed" style={{ color: 'var(--on-surface)' }}>{question.question}</p>

      {question.type === 'MCQ' && question.choices ? (
        <div className="flex flex-col gap-1">
          {question.choices.map((c) => {
            const selected = answer === c
            const isCorrect = submitted && c === question.correctAnswer
            const isWrong = submitted && selected && !correct
            return (
              <button
                key={c}
                disabled={submitted}
                onClick={() => onChange(c)}
                className={clsx(
                  'text-left text-xs px-2.5 py-1.5 rounded-lg border transition-all',
                  selected && !submitted ? 'border-[rgba(198,198,200,0.4)] bg-white/[0.05]' : 'border-transparent',
                  isCorrect ? 'border-[#6ee7b7] bg-[#6ee7b720]' : '',
                  isWrong ? 'border-[#ee7d77] bg-[#ee7d7720]' : '',
                  !submitted && !selected ? 'hover:bg-white/[0.03]' : ''
                )}
                style={{ color: 'var(--on-muted)' }}
              >
                {c}
              </button>
            )
          })}
        </div>
      ) : (
        <textarea
          className="input-base resize-none text-xs"
          rows={2}
          disabled={submitted}
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer…"
        />
      )}

      {submitted && (
        <div className="flex items-start gap-1.5 mt-1">
          {correct
            ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#6ee7b7' }} />
            : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#ee7d77' }} />}
          {!correct && (
            <p className="text-[11px]" style={{ color: 'var(--on-muted)' }}>
              <span style={{ color: '#6ee7b7' }}>{question.correctAnswer}</span>
              {question.explanation && ` — ${question.explanation}`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
