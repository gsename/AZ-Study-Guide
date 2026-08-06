import type { QuestionResponse } from '../types'

/**
 * Fallback only, for a referential that declares no item count. Every code path
 * that can consult `examMeta.questionCountRange` must prefer it — this constant
 * used to be the single hardcoded exam length, which left the authored range
 * dead and made the mock exam a fixed 55 questions on every certification.
 */
export const FALLBACK_EXAM_QUESTION_COUNT = 55

/**
 * The exam lengths a learner may pick, derived from the referential's declared
 * item count: the low end, the midpoint, and the high end of `"40-60"`.
 *
 * A single figure (`"50"`) yields one option. Note that the range itself is not
 * always an official number — Microsoft no longer publishes item counts, so for
 * SC-500 it is a community estimate, flagged as such by
 * `examMeta.questionCountRangeSource` and surfaced in the UI.
 */
export function examLengthOptions(questionCountRange?: string): number[] {
  const numbers = [...(questionCountRange ?? '').matchAll(/\d+/g)].map((m) => Number(m[0]))
  if (numbers.length === 0) return [FALLBACK_EXAM_QUESTION_COUNT]
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  if (min === max) return [min]
  return [...new Set([min, Math.round((min + max) / 2), max])].sort((a, b) => a - b)
}

/** The midpoint length, used as the pre-selected option. */
export function defaultExamLength(questionCountRange?: string): number {
  const options = examLengthOptions(questionCountRange)
  return options[Math.floor(options.length / 2)]
}

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
