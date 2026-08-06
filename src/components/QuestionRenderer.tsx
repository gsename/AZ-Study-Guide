import type { CaseStudy, QuestionResponse, QuizQuestion } from '../types'
import QuestionCard from './QuestionCard'
import ReorderQuestion from './ReorderQuestion'
import ActiveScreenQuestion from './ActiveScreenQuestion'
import StatementGridQuestion from './StatementGridQuestion'
import DragMatchQuestion from './DragMatchQuestion'
import DropdownSentenceQuestion from './DropdownSentenceQuestion'
import BuildListQuestion from './BuildListQuestion'

interface QuestionRendererProps {
  question: QuizQuestion
  caseStudy?: CaseStudy | null
  response: QuestionResponse
  displayChoices?: string[]
  onToggleChoice: (choice: string) => void
  onReorder: (order: string[]) => void
  onSetField: (fieldId: string, value: string) => void
  revealed: boolean
  questionNumber: number
  totalQuestions: number
}

/**
 * Dispatches to the right question UI based on question.type, so callers
 * (Quiz, ExamSession) don't need to know the per-type rendering details.
 *
 * Ten types, three response shapes: `onReorder` serves the two sequence formats,
 * `onSetField` the four map formats, and `onToggleChoice` the four choice
 * formats. Adding a format means adding a renderer here, not a new callback.
 */
export default function QuestionRenderer({
  question,
  caseStudy,
  response,
  displayChoices,
  onToggleChoice,
  onReorder,
  onSetField,
  revealed,
  questionNumber,
  totalQuestions,
}: QuestionRendererProps) {
  const order = response.kind === 'order' ? response.order : []
  const values = response.kind === 'fields' ? response.values : {}

  if (question.type === 'reorder') {
    return (
      <ReorderQuestion
        question={question}
        order={order}
        onChange={onReorder}
        revealed={revealed}
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
      />
    )
  }

  if (question.type === 'build-list') {
    return (
      <BuildListQuestion
        question={question}
        order={order}
        onChange={onReorder}
        revealed={revealed}
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
      />
    )
  }

  if (question.type === 'active-screen') {
    return (
      <ActiveScreenQuestion
        question={question}
        values={values}
        onChange={onSetField}
        revealed={revealed}
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
      />
    )
  }

  if (question.type === 'statement-grid') {
    return (
      <StatementGridQuestion
        question={question}
        values={values}
        onChange={onSetField}
        revealed={revealed}
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
      />
    )
  }

  if (question.type === 'drag-match') {
    return (
      <DragMatchQuestion
        question={question}
        values={values}
        onChange={onSetField}
        revealed={revealed}
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
      />
    )
  }

  if (question.type === 'dropdown-sentence') {
    return (
      <DropdownSentenceQuestion
        question={question}
        values={values}
        onChange={onSetField}
        revealed={revealed}
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
      />
    )
  }

  return (
    <QuestionCard
      question={question}
      displayChoices={displayChoices}
      caseStudy={caseStudy}
      selected={response.kind === 'choices' ? response.selected : []}
      onChange={onToggleChoice}
      revealed={revealed}
      questionNumber={questionNumber}
      totalQuestions={totalQuestions}
    />
  )
}
