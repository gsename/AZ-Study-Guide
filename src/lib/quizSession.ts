import type { QuestionResponse, QuizQuestion } from '../types'
import { shuffle, seededShuffle } from './examBuilder'
import { emptyResponse } from './grading'

export const DEFAULT_QUIZ_SIZE = 20

export interface PreparedQuestion {
  question: QuizQuestion
  displayChoices?: string[]
  initialOrder?: string[]
}

/**
 * Types that carry no flat `choices` list, so there is nothing to shuffle for
 * display. Each shuffles its own payload internally where authored order would
 * otherwise leak the answer.
 */
const NO_CHOICE_LIST = new Set<QuizQuestion['type']>([
  'active-screen',
  'statement-grid',
  'drag-match',
  'dropdown-sentence',
  'build-list',
])

/**
 * Turns an authored question into what the renderer needs, shuffling the choice
 * list so the authored answer position carries no information.
 *
 * Lives here rather than in a page because two callers need identical behaviour:
 * the per-objective quiz and the review replay. Duplicating it would let the
 * replay drift into showing choices in authored order, which is exactly the tell
 * the shuffle exists to remove.
 */
export function prepareQuestion(question: QuizQuestion, salt: string): PreparedQuestion {
  if (question.type === 'reorder') {
    return { question, initialOrder: shuffle(question.reorderItems ?? []) }
  }
  // build-list is deliberately NOT pre-seeded: it starts empty because the
  // learner has to decide which pool items belong before ordering them.
  if (NO_CHOICE_LIST.has(question.type)) {
    return { question }
  }
  return { question, displayChoices: seededShuffle(question.choices ?? [], `${question.id}:${salt}`) }
}

/**
 * The response a question starts with. Only `reorder` is seeded — with the
 * shuffled item list, because an empty order would render no draggable items at
 * all.
 */
export function initialResponseFor(prepared: PreparedQuestion): QuestionResponse {
  if (prepared.question.type === 'reorder') {
    return { kind: 'order', order: prepared.initialOrder ?? [] }
  }
  return emptyResponse(prepared.question)
}
