import type { QuizQuestion } from '../types'
import { renderInline } from './RichText'

interface StatementGridQuestionProps {
  question: QuizQuestion
  values: Record<string, string>
  onChange: (statementId: string, value: string) => void
  revealed: boolean
  questionNumber: number
  totalQuestions: number
}

const ANSWERS = ['Yes', 'No']

/**
 * The "For each of the following statements, select Yes if the statement is
 * true" format. Every row is answered independently but the item scores
 * all-or-nothing, exactly as the real exam scores it — so the per-row feedback
 * on reveal is the diagnostic value a revision tool adds.
 */
export default function StatementGridQuestion({
  question,
  values,
  onChange,
  revealed,
  questionNumber,
  totalQuestions,
}: StatementGridQuestionProps) {
  const statements = question.statements ?? []
  const rightCount = statements.filter((s) => values[s.id] === s.correctValue).length

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
        <span className="chip warn">Grille Oui/Non — chaque ligne compte</span>
      </div>

      <h3 style={{ marginTop: 0 }}>{renderInline(question.prompt)}</h3>

      <div className="statement-grid">
        {statements.map((statement) => {
          const current = values[statement.id] ?? ''
          const isRight = current === statement.correctValue
          return (
            <div
              key={statement.id}
              className={`statement-row${revealed ? (isRight ? ' correct' : ' incorrect') : ''}`}
            >
              <span className="statement-text">{renderInline(statement.text)}</span>
              <span className="statement-answers">
                {ANSWERS.map((answer) => (
                  <button
                    key={answer}
                    type="button"
                    className={`statement-pick${current === answer ? ' picked' : ''}`}
                    disabled={revealed}
                    aria-pressed={current === answer}
                    onClick={() => onChange(statement.id, answer)}
                  >
                    {answer === 'Yes' ? 'Oui' : 'Non'}
                  </button>
                ))}
              </span>
              {revealed && !isRight && (
                <span className="statement-expected muted">
                  attendu : {statement.correctValue === 'Yes' ? 'Oui' : 'Non'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {revealed && (
        <div className="explanation-box">
          <strong>💡 Explication</strong>
          <p className="muted" style={{ margin: '0.3rem 0 0', fontSize: '0.85rem' }}>
            {rightCount} / {statements.length} lignes correctes — l'examen note ce type d'item en
            tout ou rien.
          </p>
          <p style={{ margin: '0.4rem 0 0' }}>{renderInline(question.explanation)}</p>
        </div>
      )}
    </div>
  )
}
