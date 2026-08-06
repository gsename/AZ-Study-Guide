import { useMemo } from 'react'
import type { QuizQuestion } from '../types'
import { seededShuffle } from '../lib/examBuilder'
import { renderInline } from './RichText'

interface DropdownSentenceQuestionProps {
  question: QuizQuestion
  values: Record<string, string>
  onChange: (blankId: string, value: string) => void
  revealed: boolean
  questionNumber: number
  totalQuestions: number
}

/** Splits "Use [[b1]] to grant [[b2]]" into literal text and blank references. */
function parseTemplate(template: string): { text?: string; blankId?: string }[] {
  return template
    .split(/(\[\[[^\]]+\]\])/)
    .filter((part) => part !== '')
    .map((part) =>
      part.startsWith('[[') && part.endsWith(']]')
        ? { blankId: part.slice(2, -2).trim() }
        : { text: part },
    )
}

/**
 * "Select the answers that complete the statement." A sentence with inline
 * dropdowns — roughly 90% of `active-screen`, but the blanks sit inside prose
 * rather than in a simulated portal panel, which is how Microsoft presents it.
 *
 * Each blank's options are shuffled deterministically per item, so the authored
 * position of the correct value carries no tell even though the sentence itself
 * has to stay in reading order.
 */
export default function DropdownSentenceQuestion({
  question,
  values,
  onChange,
  revealed,
  questionNumber,
  totalQuestions,
}: DropdownSentenceQuestionProps) {
  const blanks = question.blanks ?? []
  const blanksById = useMemo(() => new Map(blanks.map((b) => [b.id, b])), [blanks])
  const parts = useMemo(() => parseTemplate(question.template ?? ''), [question.template])
  const optionsById = useMemo(
    () =>
      new Map(blanks.map((b) => [b.id, seededShuffle(b.options, `${question.id}:${b.id}`)] as const)),
    [blanks, question.id],
  )

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
        <span className="chip warn">Compléter la phrase — chaque liste compte</span>
      </div>

      <h3 style={{ marginTop: 0 }}>{renderInline(question.prompt)}</h3>

      <p className="sentence-template">
        {parts.map((part, i) => {
          if (part.text !== undefined) return <span key={i}>{part.text}</span>
          const blank = blanksById.get(part.blankId!)
          if (!blank) return <span key={i}>{`[[${part.blankId}]]`}</span>
          const current = values[blank.id] ?? ''
          const isRight = current === blank.correctValue
          return (
            <span key={i} className="sentence-blank">
              <select
                className={`sentence-select${revealed ? (isRight ? ' correct' : ' incorrect') : ''}`}
                value={current}
                disabled={revealed}
                aria-label={`Choix ${blank.id}`}
                onChange={(e) => onChange(blank.id, e.target.value)}
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {(optionsById.get(blank.id) ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {revealed && !isRight && (
                <span className="muted sentence-expected"> (attendu : {blank.correctValue})</span>
              )}
            </span>
          )
        })}
      </p>

      {revealed && (
        <div className="explanation-box">
          <strong>💡 Explication</strong>
          <p style={{ margin: '0.4rem 0 0' }}>{renderInline(question.explanation)}</p>
        </div>
      )}
    </div>
  )
}
