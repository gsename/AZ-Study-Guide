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
  // With no weight to distribute by, there is no allocation. Without this guard
  // every fraction is 0, the remainder is the whole total, and the loop below
  // hands one question to each bucket — returning [1,1] for a request of 4 and
  // silently producing a short exam. `scripts/check-bank.mjs` guards the same
  // case the same way; the two must not diverge on any input.
  if (sum <= 0 || total <= 0) return weights.map(() => 0)
  const raw = weights.map((w) => (w / sum) * total)
  const base = raw.map(Math.floor)
  const allocated = base.reduce((a, b) => a + b, 0)
  const remainder = total - allocated

  // Three sort keys, not one. Sorting on `frac` alone leaves exact ties to
  // Array.prototype.sort's internals: SC-500's domain midpoints are
  // 22.5 / 27.5 / 22.5 / 22.5, so THREE domains tie exactly and the leftover
  // question goes to whichever the engine happens to favour. It currently lands
  // on d1 only because V8's sort is stable — an implementation detail, not a
  // stated rule, and `scripts/check-bank.mjs` asserts these allocations. Heavier
  // weight wins a tie, then lower index, so the outcome is specified.
  const fractions = raw
    .map((r, i) => ({ i, frac: r - base[i], w: weights[i] }))
    .sort((a, b) => b.frac - a.frac || b.w - a.w || a.i - b.i)

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
 *
 * `constraintSharePercent` reserves that share of EACH domain's allocation for
 * items marked `decision` — the ones where several options do the job and only
 * one respects least privilege, lowest cost, or widest coverage. Without it, a
 * bank holding 2.3% such items yields 0.9 of them in a 40-question draw, so the
 * shape a real exam leans on effectively never appears.
 *
 * The quota is applied INSIDE each domain's count, never across domains: the
 * allocation `allocateByWeight` produced is what the published blueprint says,
 * and trading that away for this would be a worse exam, not a better one.
 *
 * Defaults to 0, which reproduces the original draw exactly — a certification
 * that has not measured a share of its own keeps the plain weighted draw.
 */
export function buildExam(
  domains: Domain[],
  objectivesByDomain: Record<string, Objective[]>,
  questionsByObjective: Record<string, QuizQuestion[]>,
  totalQuestions: number,
  constraintSharePercent = 0,
): QuizQuestion[] {
  const weights = domains.map(domainWeightMidpoint)
  const counts = allocateByWeight(weights, totalQuestions)

  const selected: QuizQuestion[] = []
  domains.forEach((domain, idx) => {
    const objectiveIds = (objectivesByDomain[domain.id] ?? []).map((o) => o.id)
    const pool = objectiveIds.flatMap((oid) => questionsByObjective[oid] ?? [])
    const need = Math.min(counts[idx], pool.length)

    if (constraintSharePercent <= 0) {
      selected.push(...shuffle(pool).slice(0, need))
      return
    }

    // Take what the domain can supply rather than what the share asks for: a
    // domain with too few constraint items must still contribute `need`
    // questions, otherwise the quota would quietly shorten the exam.
    const constraintPool = pool.filter((q) => q.decision)
    const plainPool = pool.filter((q) => !q.decision)
    const want = Math.min(Math.round((need * constraintSharePercent) / 100), constraintPool.length)
    const picked = shuffle(constraintPool).slice(0, want)

    // The remainder is drawn from NON-constraint items only, which makes the
    // share a target rather than a floor. Letting the remainder draw from the
    // whole pool would overshoot — on this bank, 22% instead of 17% — and
    // `ExamStart` states the count to the learner, so the draw owes them that
    // number rather than "at least" it.
    const plain = shuffle(plainPool).slice(0, need - picked.length)

    // Only if the domain has too few plain items does it top up from the
    // constraint ones it did not reserve, so length still wins over composition.
    const short = need - picked.length - plain.length
    const topUp = short > 0 ? shuffle(constraintPool.filter((q) => !picked.includes(q))).slice(0, short) : []

    selected.push(...picked, ...plain, ...topUp)
  })

  return shuffle(groupByCaseStudy(selected)).flat()
}

/**
 * How many constraint items a draw of `totalQuestions` will contain, so a page
 * can state the composition it is about to produce instead of asserting it.
 * Mirrors the arithmetic above, including the per-domain clamp.
 */
export function constraintCount(
  domains: Domain[],
  objectivesByDomain: Record<string, Objective[]>,
  questionsByObjective: Record<string, QuizQuestion[]>,
  totalQuestions: number,
  constraintSharePercent = 0,
): number {
  if (constraintSharePercent <= 0) return 0
  const counts = allocateByWeight(domains.map(domainWeightMidpoint), totalQuestions)
  return domains.reduce((sum, domain, idx) => {
    const pool = (objectivesByDomain[domain.id] ?? []).flatMap(
      (o) => questionsByObjective[o.id] ?? [],
    )
    const need = Math.min(counts[idx], pool.length)
    const available = pool.filter((q) => q.decision).length
    return sum + Math.min(Math.round((need * constraintSharePercent) / 100), available)
  }, 0)
}

/**
 * Collects questions that share a `caseStudyId` into contiguous blocks, so the
 * exam presents a case study once with its questions together — as the real one
 * does. A standalone question is a block of one.
 *
 * Without this, the final `shuffle` scattered them: `cs-tailspin-identity` has
 * 12 questions against a 1,262-character scenario, which the learner then had to
 * re-read at 12 random points in the exam. That is a fidelity defect, not a
 * cosmetic one — reading the scenario is most of the work in a case study, and
 * paying that cost twelve times measures stamina rather than knowledge.
 *
 * `caseStudyId` is overloaded on purpose: `cs-*` is a real multi-question case
 * study, `sg-*` a "does the solution meet the goal?" series. Both belong
 * together, so both are grouped. Blocks are shuffled internally as well as
 * against each other, so authored order inside a block carries no tell.
 */
function groupByCaseStudy(questions: QuizQuestion[]): QuizQuestion[][] {
  const blocks: QuizQuestion[][] = []
  const byGroup = new Map<string, QuizQuestion[]>()

  for (const q of questions) {
    if (!q.caseStudyId) {
      blocks.push([q])
      continue
    }
    const existing = byGroup.get(q.caseStudyId)
    if (existing) {
      existing.push(q)
    } else {
      const block = [q]
      byGroup.set(q.caseStudyId, block)
      // Pushed on first sight, so a group keeps its place in the block order
      // rather than being appended after every standalone question.
      blocks.push(block)
    }
  }

  return blocks.map((block) => (block.length > 1 ? shuffle(block) : block))
}

export function scaleScore(correctCount: number, totalCount: number): number {
  if (totalCount === 0) return 0
  return Math.round((correctCount / totalCount) * 1000)
}
