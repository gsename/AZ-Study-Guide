/**
 * The set of question ids a review replay should draw from.
 *
 * Held in `sessionStorage` rather than passed through the URL: the queue can run
 * to a hundred ids, and a hash route carrying them all would be unreadable and
 * would break the moment a browser clipped it. Session-scoped is also the right
 * lifetime — a replay is a one-off, unlike `userProgress`, which belongs in
 * IndexedDB.
 *
 * Mirrors `examSession.ts`, which stores an in-flight mock exam the same way.
 */
function storageKey(certId: string): string {
  return `study-guide-review-selection-${certId}`
}

export function saveReviewSelection(certId: string, questionIds: string[]) {
  sessionStorage.setItem(storageKey(certId), JSON.stringify(questionIds))
}

export function loadReviewSelection(certId: string): string[] {
  const raw = sessionStorage.getItem(storageKey(certId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function clearReviewSelection(certId: string) {
  sessionStorage.removeItem(storageKey(certId))
}
