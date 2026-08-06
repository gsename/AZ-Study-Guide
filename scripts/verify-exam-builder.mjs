#!/usr/bin/env node
/**
 * Unit checks for the exam draw. This repo has no test runner, and the two
 * behaviours below are exactly the kind that look right and are not:
 *
 *   - the largest-remainder allocation, whose EXACT ties were previously
 *     resolved by Array.prototype.sort's internals rather than a stated rule
 *   - case-study grouping, whose absence is invisible until you sit a mock exam
 *     and re-read the same 1,262-character scenario twelve times
 *
 * `src/lib/examBuilder.ts` is transpiled in memory with the TypeScript compiler
 * API, so there is no build step and no duplicated copy of the logic to drift.
 *
 *   node scripts/verify-exam-builder.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const SRC = path.join(process.cwd(), 'src/lib/examBuilder.ts')
const out = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'examBuilder-')), 'examBuilder.mjs')
fs.writeFileSync(tmp, out)
const { allocateByWeight, buildExam } = await import(pathToFileURL(tmp).href)

let failures = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`)
}
const assert = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`)
}

console.log('allocateByWeight — SC-500 midpoints 22.5 / 27.5 / 22.5 / 22.5')
const SC500 = [22.5, 27.5, 22.5, 22.5]
eq('  n=40', allocateByWeight(SC500, 40), [10, 12, 9, 9])
eq('  n=55', allocateByWeight(SC500, 55), [13, 16, 13, 13])
eq('  n=60', allocateByWeight(SC500, 60), [14, 18, 14, 14])

console.log('\nallocateByWeight — AZ-500 midpoints 17.5 / 22.5 / 22.5 / 32.5')
const AZ500 = [17.5, 22.5, 22.5, 32.5]
eq('  n=40', allocateByWeight(AZ500, 40), [7, 10, 9, 14])
eq('  n=55', allocateByWeight(AZ500, 55), [10, 13, 13, 19])
eq('  n=60', allocateByWeight(AZ500, 60), [11, 14, 14, 21])

console.log('\nallocateByWeight — the tie-break keys, exercised one at a time')
// Equal fractions AND equal weights: the lowest index must win, by rule.
eq('  equal frac, equal weight -> lowest index', allocateByWeight([10, 10, 10], 4), [2, 1, 1])
// Equal fractions, DIFFERENT weights: the heavier bucket must win. Without the
// `b.w - a.w` key a stable sort hands this to index 0 and returns [2, 4].
eq('  equal frac, heavier weight wins', allocateByWeight([1, 3], 6), [1, 5])
eq('  sums to total, no remainder', allocateByWeight([1, 2, 1], 4), [1, 2, 1])
eq('  zero total', allocateByWeight(SC500, 0), [0, 0, 0, 0])
eq('  zero weights', allocateByWeight([0, 0], 4), [0, 0])

let stable = true
const first = JSON.stringify(allocateByWeight(SC500, 55))
for (let i = 0; i < 200; i++) if (JSON.stringify(allocateByWeight(SC500, 55)) !== first) stable = false
assert('  deterministic over 200 calls', stable)

for (const n of [40, 55, 60]) {
  const total = allocateByWeight(SC500, n).reduce((a, b) => a + b, 0)
  assert(`  n=${n} allocation sums to ${n}`, total === n, `got ${total}`)
}

console.log('\nbuildExam — case-study questions must be contiguous')
const domains = [
  { id: 'd1', name: 'D1', weightPercent: { min: 50, max: 50 } },
  { id: 'd2', name: 'D2', weightPercent: { min: 50, max: 50 } },
]
const objectivesByDomain = {
  d1: [{ id: 'o1' }],
  d2: [{ id: 'o2' }],
}
const q = (id, caseStudyId) => ({ id, objectiveId: id.startsWith('a') ? 'o1' : 'o2', caseStudyId })
const questionsByObjective = {
  // A 5-question case study and a 3-question solution-goal series, buried among
  // standalone questions so a passing result cannot be luck of the draw.
  o1: [
    q('a1'), q('a2', 'cs-alpha'), q('a3'), q('a4', 'cs-alpha'), q('a5'),
    q('a6', 'cs-alpha'), q('a7'), q('a8', 'cs-alpha'), q('a9'), q('a10', 'cs-alpha'),
  ],
  o2: [
    q('b1', 'sg-one'), q('b2'), q('b3', 'sg-one'), q('b4'), q('b5', 'sg-one'),
    q('b6'), q('b7'), q('b8'), q('b9'), q('b10'),
  ],
}

/** Are all questions of `groupId` in one unbroken run? */
function contiguous(exam, groupId) {
  const at = exam.map((x, i) => (x.caseStudyId === groupId ? i : -1)).filter((i) => i >= 0)
  if (at.length < 2) return true
  return at[at.length - 1] - at[0] === at.length - 1
}

let alphaOk = 0
let sgOk = 0
let orderVaried = new Set()
const RUNS = 300
for (let i = 0; i < RUNS; i++) {
  const exam = buildExam(domains, objectivesByDomain, questionsByObjective, 20)
  if (exam.length !== 20) {
    assert('  draws the requested count', false, `got ${exam.length}`)
    break
  }
  if (contiguous(exam, 'cs-alpha')) alphaOk++
  if (contiguous(exam, 'sg-one')) sgOk++
  orderVaried.add(exam.map((x) => x.id).join(','))
}
assert(`  cs-alpha contiguous in all ${RUNS} draws`, alphaOk === RUNS, `${alphaOk}/${RUNS}`)
assert(`  sg-one contiguous in all ${RUNS} draws`, sgOk === RUNS, `${sgOk}/${RUNS}`)
// Grouping must not have frozen the exam into one fixed order.
assert('  draw order still varies between exams', orderVaried.size > RUNS * 0.9, `${orderVaried.size} distinct orders in ${RUNS} draws`)

// Every drawn question must be a real one, exactly once.
const one = buildExam(domains, objectivesByDomain, questionsByObjective, 20)
assert('  no duplicate questions in a draw', new Set(one.map((x) => x.id)).size === one.length)
const known = new Set([...questionsByObjective.o1, ...questionsByObjective.o2].map((x) => x.id))
assert('  every drawn question exists in the pool', one.every((x) => known.has(x.id)))

console.log('')
console.log(failures ? `${failures} FAILURE(S)` : 'all exam-draw checks passed')
process.exit(failures ? 1 : 0)
