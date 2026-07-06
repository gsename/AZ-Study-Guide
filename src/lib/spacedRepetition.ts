import type { UserProgress } from '../types'

const DEFAULT_EASE_FACTOR = 2.5
const MIN_EASE_FACTOR = 1.3
const MAX_HISTORY_ENTRIES = 30

/**
 * Maps session accuracy (fraction correct) to an SM-2 quality score (0-5).
 * The classic SM-2 algorithm expects a self-reported recall quality; since
 * our sessions are graded (correct/incorrect per question), we derive an
 * equivalent quality from the session's accuracy.
 */
export function accuracyToQuality(accuracy: number): number {
  if (accuracy >= 0.9) return 5
  if (accuracy >= 0.75) return 4
  if (accuracy >= 0.6) return 3
  if (accuracy >= 0.4) return 2
  return 0
}

export function createInitialProgress(certId: string, objectiveId: string): UserProgress {
  return {
    certId,
    objectiveId,
    lastReviewed: null,
    correctStreak: 0,
    nextReviewDate: null,
    easeFactor: DEFAULT_EASE_FACTOR,
    intervalDays: 0,
    repetitions: 0,
    history: [],
  }
}

/**
 * Applies one SM-2 update to an objective's progress record, given the
 * outcome of a quiz session (targeted quiz or the objective's slice of a
 * mock exam).
 */
export function applySm2Update(
  progress: UserProgress,
  correctCount: number,
  totalCount: number,
  now: Date = new Date(),
): UserProgress {
  const accuracy = totalCount > 0 ? correctCount / totalCount : 0
  const quality = accuracyToQuality(accuracy)

  let { easeFactor, intervalDays, repetitions, correctStreak } = progress

  if (quality < 3) {
    repetitions = 0
    intervalDays = 1
    correctStreak = 0
  } else {
    repetitions += 1
    if (repetitions === 1) intervalDays = 1
    else if (repetitions === 2) intervalDays = 6
    else intervalDays = Math.round(intervalDays * easeFactor)

    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor)
    correctStreak += 1
  }

  const nextReviewDate = new Date(now)
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays)

  const history = [
    ...progress.history,
    {
      date: now.toISOString(),
      accuracy,
      quality,
      correctCount,
      totalCount,
    },
  ].slice(-MAX_HISTORY_ENTRIES)

  return {
    ...progress,
    lastReviewed: now.toISOString(),
    correctStreak,
    nextReviewDate: nextReviewDate.toISOString(),
    easeFactor,
    intervalDays,
    repetitions,
    history,
  }
}

export function isOverdue(progress: UserProgress | undefined, now: Date = new Date()): boolean {
  if (!progress?.nextReviewDate) return false
  return new Date(progress.nextReviewDate).getTime() <= now.getTime()
}

export function latestAccuracy(progress: UserProgress | undefined): number | null {
  if (!progress || progress.history.length === 0) return null
  return progress.history[progress.history.length - 1].accuracy
}
