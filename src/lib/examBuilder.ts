import type { Domain, Objective, QuizQuestion } from '../types'

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function hashString(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Deterministic shuffle keyed by a seed string. Same seed → same order,
 * so a question's choice order stays stable while a session is open
 * (across re-renders and back/forward navigation) but changes between
 * sessions when the seed (salt) changes.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rng = mulberry32(hashString(seed))
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Allocates `total` integer slots across weighted buckets using the
 * largest-remainder method, so the rounded allocation still sums to `total`.
 */
export function allocateByWeight(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map((w) => (sum > 0 ? (w / sum) * total : 0))
  const base = raw.map(Math.floor)
  const allocated = base.reduce((a, b) => a + b, 0)
  let remainder = total - allocated

  const fractions = raw
    .map((r, i) => ({ i, frac: r - base[i] }))
    .sort((a, b) => b.frac - a.frac)

  const counts = [...base]
  for (let k = 0; k < remainder && k < fractions.length; k++) {
    counts[fractions[k].i] += 1
  }
  return counts
}

export function domainWeightMidpoint(domain: Domain): number {
  return (domain.weightPercent.min + domain.weightPercent.max) / 2
}

/**
 * Builds a mock-exam question set drawn proportionally to each domain's
 * official exam weighting (using the midpoint of its published range).
 */
export function buildExam(
  domains: Domain[],
  objectivesByDomain: Record<string, Objective[]>,
  questionsByObjective: Record<string, QuizQuestion[]>,
  totalQuestions: number,
): QuizQuestion[] {
  const weights = domains.map(domainWeightMidpoint)
  const counts = allocateByWeight(weights, totalQuestions)

  const selected: QuizQuestion[] = []
  domains.forEach((domain, idx) => {
    const objectiveIds = (objectivesByDomain[domain.id] ?? []).map((o) => o.id)
    const pool = objectiveIds.flatMap((oid) => questionsByObjective[oid] ?? [])
    const need = Math.min(counts[idx], pool.length)
    selected.push(...shuffle(pool).slice(0, need))
  })

  return shuffle(selected)
}

export function scaleScore(correctCount: number, totalCount: number): number {
  if (totalCount === 0) return 0
  return Math.round((correctCount / totalCount) * 1000)
}
