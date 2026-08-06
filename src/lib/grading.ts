import type { QuestionResponse, QuizQuestion } from '../types'

/** Types graded as a label→value map, i.e. `{ kind: 'fields' }`. */
const FIELD_TYPES = new Set(['active-screen', 'statement-grid', 'drag-match', 'dropdown-sentence'])
/** Types graded as a sequence, i.e. `{ kind: 'order' }`. */
const ORDER_TYPES = new Set(['reorder', 'build-list'])

/** Produces the "empty" response shape appropriate for a question's type. */
export function emptyResponse(question: QuizQuestion): QuestionResponse {
  if (ORDER_TYPES.has(question.type)) return { kind: 'order', order: [] }
  if (FIELD_TYPES.has(question.type)) return { kind: 'fields', values: {} }
  return { kind: 'choices', selected: [] }
}

export function hasAnswer(response: QuestionResponse): boolean {
  if (response.kind === 'choices') return response.selected.length > 0
  if (response.kind === 'order') return response.order.length > 0
  return Object.keys(response.values).length > 0
}

/** Human-readable label for a field-graded row, so a review can name it. */
function fieldLabel(question: QuizQuestion, fieldId: string): string {
  switch (question.type) {
    case 'active-screen':
      return question.fields?.find((f) => f.id === fieldId)?.label ?? fieldId
    case 'statement-grid':
      return question.statements?.find((s) => s.id === fieldId)?.text ?? fieldId
    case 'drag-match':
      return question.targets?.find((t) => t.id === fieldId)?.label ?? fieldId
    default:
      return fieldId
  }
}

/**
 * Renders a stored response as readable lines, so a review screen can show what
 * the learner actually answered next to what was correct.
 *
 * Returns an empty array when there is nothing to show — including for attempts
 * recorded before `QuizAttempt.response` existed (Dexie v1). The caller must say
 * "not recorded" rather than hide the row: a silently missing answer looks like
 * a bug in the review, not like an old attempt.
 */
export function describeResponse(
  question: QuizQuestion,
  response: QuestionResponse | undefined,
): string[] {
  if (!response) return []
  if (response.kind === 'choices') return response.selected
  if (response.kind === 'order') return response.order.map((item, i) => `${i + 1}. ${item}`)
  // `dropdown-sentence` blanks have no label of their own — the template is the
  // context — so they are numbered instead of named.
  const entries = Object.entries(response.values).filter(([, value]) => value !== '')
  if (question.type === 'dropdown-sentence') {
    const order = question.blanks?.map((b) => b.id) ?? []
    return entries
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([id, value], i) => `${order.includes(id) ? i + 1 : id}. ${value}`)
  }
  return entries.map(([id, value]) => `${fieldLabel(question, id)} → ${value}`)
}

/**
 * The same, for the correct answer, so both sides of a review are produced by
 * one code path and cannot drift apart.
 */
export function describeCorrectAnswer(question: QuizQuestion): string[] {
  if (ORDER_TYPES.has(question.type)) {
    const order = question.type === 'build-list' ? question.correctOrder : question.reorderItems
    return (order ?? []).map((item, i) => `${i + 1}. ${item}`)
  }
  if (FIELD_TYPES.has(question.type)) {
    const expected = expectedFields(question) ?? []
    if (question.type === 'dropdown-sentence')
      return expected.map((f, i) => `${i + 1}. ${f.correctValue}`)
    return expected.map((f) => `${fieldLabel(question, f.id)} → ${f.correctValue}`)
  }
  return question.correctAnswers ?? []
}

/**
 * The expected `{id, correctValue}` pairs for a field-graded question, so all
 * four field types share one comparison. `active-screen` uses `fields`,
 * `statement-grid` uses `statements`, `drag-match` uses `targets` (keyed on
 * `correctSource`) and `dropdown-sentence` uses `blanks`.
 */
function expectedFields(question: QuizQuestion): { id: string; correctValue: string }[] | null {
  switch (question.type) {
    case 'active-screen':
      return question.fields ?? null
    case 'statement-grid':
      return question.statements ?? null
    case 'drag-match':
      return question.targets?.map((t) => ({ id: t.id, correctValue: t.correctSource })) ?? null
    case 'dropdown-sentence':
      return question.blanks ?? null
    default:
      return null
  }
}

/**
 * All-or-nothing for every type, which matches how the real exam scores a
 * multi-row item. `ReorderQuestion` and the grid renderers still compute
 * per-row correctness for display, so the learner sees which row was wrong.
 */
export function isQuestionCorrect(question: QuizQuestion, response: QuestionResponse): boolean {
  if (ORDER_TYPES.has(question.type)) {
    // build-list draws from a pool larger than the answer, so an exact
    // length match here also asserts that every distractor was excluded.
    const correctOrder =
      question.type === 'build-list' ? question.correctOrder : question.reorderItems
    if (response.kind !== 'order' || !correctOrder) return false
    if (response.order.length !== correctOrder.length) return false
    return response.order.every((item, i) => item === correctOrder[i])
  }

  if (FIELD_TYPES.has(question.type)) {
    const expected = expectedFields(question)
    if (response.kind !== 'fields' || !expected) return false
    return expected.every((field) => response.values[field.id] === field.correctValue)
  }

  // single / multiple / case-study / solution-goal all compare a selected
  // choice set against correctAnswers.
  const correctAnswers = question.correctAnswers ?? []
  if (response.kind !== 'choices') return false
  if (response.selected.length !== correctAnswers.length) return false
  const correctSet = new Set(correctAnswers)
  return response.selected.every((choice) => correctSet.has(choice))
}
