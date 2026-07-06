import type { CaseStudy, QuizQuestion } from '../types'
import { renderInline } from './RichText'

interface QuestionCardProps {
  question: QuizQuestion
  caseStudy?: CaseStudy | null
  selected: string[]
  onChange: (choice: string) => void
  revealed: boolean
  questionNumber: number
  totalQuestions: number
  /** Choices in the order to display (already shuffled by the parent). */
  displayChoices?: string[]
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export default function QuestionCard({
  question,
  caseStudy,
  selected,
  onChange,
  revealed,
  questionNumber,
  totalQuestions,
  displayChoices,
}: QuestionCardProps) {
  const isMultiple = question.type === 'multiple'
  const choices = displayChoices ?? question.choices ?? []
  const correctAnswers = question.correctAnswers ?? []

  function choiceClassName(choice: string): string {
    const classes = ['choice']
    const isSelected = selected.includes(choice)
    if (!revealed) {
      if (isSelected) classes.push('selected')
      return classes.join(' ')
    }
    const isCorrect = correctAnswers.includes(choice)
    if (isCorrect) classes.push('correct')
    else if (isSelected) classes.push('incorrect')
    return classes.join(' ')
  }

  function markerContent(choice: string, letter: string): string {
    if (!revealed) return selected.includes(choice) ? (isMultiple ? '✓' : letter) : letter
    const isCorrect = correctAnswers.includes(choice)
    if (isCorrect) return '✓'
    if (selected.includes(choice)) return '✕'
    return letter
  }

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
        {isMultiple && <span className="chip warn">Choisir {correctAnswers.length}</span>}
      </div>

      {caseStudy && (
        <div className="case-study-box">
          <strong>📄 {caseStudy.title}</strong>
          {'\n'}
          {caseStudy.scenario}
        </div>
      )}

      <h3 style={{ marginTop: 0 }}>{renderInline(question.prompt)}</h3>

      <div>
        {choices.map((choice, i) => (
          <button
            key={choice}
            type="button"
            className={choiceClassName(choice)}
            disabled={revealed}
            onClick={() => onChange(choice)}
          >
            <span className="choice-marker">{markerContent(choice, LETTERS[i])}</span>
            <span>{choice}</span>
          </button>
        ))}
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
