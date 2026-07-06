import type { QuestionResponse } from '../types'

export const DEFAULT_EXAM_QUESTION_COUNT = 55

function storageKey(certId: string): string {
  return `study-guide-exam-session-${certId}`
}

export interface ExamSessionState {
  questionIds: string[]
  startedAt: string
  durationMinutes: number
  answers: Record<string, QuestionResponse>
  /**
   * IDs of 'solution-goal' questions the learner has already moved past.
   * Mirrors the real exam behavior: once you leave this question type you
   * cannot return to change (or even revisit) the answer.
   */
  lockedQuestionIds: string[]
}

export function saveExamSession(certId: string, session: ExamSessionState) {
  sessionStorage.setItem(storageKey(certId), JSON.stringify(session))
}

export function loadExamSession(certId: string): ExamSessionState | null {
  const raw = sessionStorage.getItem(storageKey(certId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as ExamSessionState
  } catch {
    return null
  }
}

export function clearExamSession(certId: string) {
  sessionStorage.removeItem(storageKey(certId))
}

export function remainingSeconds(session: ExamSessionState, now: Date = new Date()): number {
  const elapsedMs = now.getTime() - new Date(session.startedAt).getTime()
  const totalSeconds = session.durationMinutes * 60
  return Math.max(0, totalSeconds - Math.floor(elapsedMs / 1000))
}
