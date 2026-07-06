import type { CaseStudy, QuestionResponse, QuizQuestion } from '../types'
import QuestionCard from './QuestionCard'
import ReorderQuestion from './ReorderQuestion'
import ActiveScreenQuestion from './ActiveScreenQuestion'

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
  if (question.type === 'reorder') {
    return (
      <ReorderQuestion
        question={question}
        order={response.kind === 'order' ? response.order : []}
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
        values={response.kind === 'fields' ? response.values : {}}
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
