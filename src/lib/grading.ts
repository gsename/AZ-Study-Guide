import type { QuestionResponse, QuizQuestion } from '../types'

/** Produces the "empty" response shape appropriate for a question's type. */
export function emptyResponse(question: QuizQuestion): QuestionResponse {
  if (question.type === 'reorder') return { kind: 'order', order: [] }
  if (question.type === 'active-screen') return { kind: 'fields', values: {} }
  return { kind: 'choices', selected: [] }
}

export function hasAnswer(response: QuestionResponse): boolean {
  if (response.kind === 'choices') return response.selected.length > 0
  if (response.kind === 'order') return response.order.length > 0
  return Object.keys(response.values).length > 0
}

export function isQuestionCorrect(question: QuizQuestion, response: QuestionResponse): boolean {
  if (question.type === 'reorder') {
    if (response.kind !== 'order' || !question.reorderItems) return false
    if (response.order.length !== question.reorderItems.length) return false
    return response.order.every((item, i) => item === question.reorderItems![i])
  }

  if (question.type === 'active-screen') {
    if (response.kind !== 'fields' || !question.fields) return false
    return question.fields.every((field) => response.values[field.id] === field.correctValue)
  }

  // single / multiple / case-study / solution-goal all compare a selected
  // choice set against correctAnswers.
  const correctAnswers = question.correctAnswers ?? []
  if (response.kind !== 'choices') return false
  if (response.selected.length !== correctAnswers.length) return false
  const correctSet = new Set(correctAnswers)
  return response.selected.every((choice) => correctSet.has(choice))
}
