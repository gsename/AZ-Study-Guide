import type { QuizAttempt, QuizQuestion, UserProgress } from '../types'

export interface ReviewEntry {
  question: QuizQuestion
  /** The most recent attempt, which is the one that decides queue membership. */
  attempt: QuizAttempt
  /** True when the owning objective's spaced-repetition review date has passed. */
  overdue: boolean
}

/**
 * Builds the review queue: the questions whose MOST RECENT attempt was wrong.
 *
 * The distinction matters more than it looks. Selecting every question that was
 * ever answered wrong makes the queue grow monotonically — an item you have since
 * learned stays in it forever, the count never falls, and the list stops being a
 * work list. Keyed on the latest attempt, answering an item correctly removes it,
 * which is the behaviour that makes the number mean something.
 *
 * Ordering puts overdue objectives first, so the queue agrees with the
 * spaced-repetition schedule the dashboard already shows instead of presenting a
 * second, contradictory idea of what is urgent. Within that, oldest attempt
 * first: the answer you can no longer remember giving is the one worth revisiting.
 */
export function buildReviewQueue(
  attempts: QuizAttempt[],
  questionsById: Record<string, QuizQuestion>,
  progressByObjective: Map<string, UserProgress>,
  now: Date = new Date(),
): ReviewEntry[] {
  const latestByQuestion = new Map<string, QuizAttempt>()
  for (const attempt of attempts) {
    const seen = latestByQuestion.get(attempt.questionId)
    if (!seen || attempt.timestamp > seen.timestamp) latestByQuestion.set(attempt.questionId, attempt)
  }

  const entries: ReviewEntry[] = []
  for (const attempt of latestByQuestion.values()) {
    if (attempt.correct) continue
    // An attempt can outlive its question: content is edited, ids are retired.
    // Skip rather than render a placeholder for a question that no longer exists.
    const question = questionsById[attempt.questionId]
    if (!question) continue
    const nextReview = progressByObjective.get(question.objectiveId)?.nextReviewDate
    entries.push({
      question,
      attempt,
      overdue: nextReview !== null && nextReview !== undefined && new Date(nextReview) <= now,
    })
  }

  return entries.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) || a.attempt.timestamp.localeCompare(b.attempt.timestamp),
  )
}

/** Question ids in queue order, for a replay restricted to the queue. */
export function queueQuestionIds(entries: ReviewEntry[]): string[] {
  return entries.map((e) => e.question.id)
}
