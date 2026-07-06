import type { QuizQuestion } from '../types'
import { renderInline } from './RichText'

interface ActiveScreenQuestionProps {
  question: QuizQuestion
  values: Record<string, string>
  onChange: (fieldId: string, value: string) => void
  revealed: boolean
  questionNumber: number
  totalQuestions: number
}

export default function ActiveScreenQuestion({
  question,
  values,
  onChange,
  revealed,
  questionNumber,
  totalQuestions,
}: ActiveScreenQuestionProps) {
  const fields = question.fields ?? []

  return (
    <div className="card">
      <div className="q-progress">
        <div style={{ width: `${(questionNumber / totalQuestions) * 100}%` }} />
      </div>
      <div className="chip-row" style={{ marginBottom: '0.75rem' }}>
        <span className="chip">
          Question {questionNumber} / {totalQuestions}
        </span>
        <span className={`badge ${question.difficulty}`}>{question.difficulty}</span>
        <span className="chip warn">Active screen — configure l'écran simulé</span>
      </div>

      <h3 style={{ marginTop: 0 }}>{renderInline(question.prompt)}</h3>

      <div className="diagram">
        {question.screenTitle && <div className="diagram-title">{question.screenTitle}</div>}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {fields.map((field) => {
            const current = values[field.id] ?? (field.kind === 'toggle' ? 'Off' : '')
            const isRight = current === field.correctValue
            return (
              <div
                key={field.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '10px',
                  background: 'var(--surface)',
                  border: `1.5px solid ${revealed ? (isRight ? 'var(--good)' : 'var(--bad)') : 'var(--border-strong)'}`,
                }}
              >
                <span>{field.label}</span>
                {field.kind === 'toggle' ? (
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={revealed}
                    onClick={() => onChange(field.id, current === 'On' ? 'Off' : 'On')}
                  >
                    {current}
                  </button>
                ) : (
                  <select
                    value={current}
                    disabled={revealed}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-strong)',
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                    }}
                  >
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {(field.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
                {revealed && !isRight && (
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    attendu : {field.correctValue}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {revealed && (
        <div className="explanation-box">
          <strong>💡 Explication</strong>
          <p style={{ margin: '0.4rem 0 0' }}>{renderInline(question.explanation)}</p>
        </div>
      )}
    </div>
  )
}
