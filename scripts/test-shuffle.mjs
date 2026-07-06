// Verifies that seededShuffle redistributes the correct answer away from a
// fixed position. All questions are authored with the correct answer first;
// this proves the runtime shuffle spreads it across positions.
import fs from 'node:fs'

// Inline copies of the seededShuffle internals (mirror of src/lib/examBuilder.ts)
function hashString(s) {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function seededShuffle(items, seed) {
  const rng = mulberry32(hashString(seed))
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const objIds = ['o1-1','o1-2','o2-1','o2-2','o2-3','o3-1','o3-2','o3-3','o4-1','o4-2','o4-3','o4-4']
let all = []
objIds.forEach((id) => { all = all.concat(JSON.parse(fs.readFileSync(`src/content/quiz/${id}.json`))) })

// Determinism check
const sample = all[0]
const a1 = seededShuffle(sample.choices, `${sample.id}:salt123`)
const a2 = seededShuffle(sample.choices, `${sample.id}:salt123`)
const deterministic = JSON.stringify(a1) === JSON.stringify(a2)
console.log('Deterministic for same seed:', deterministic)

// Different salt usually gives a different order
const b = seededShuffle(sample.choices, `${sample.id}:otherSalt`)
console.log('Different salt changes order (sample):', JSON.stringify(a1) !== JSON.stringify(b))

// Distribution of the correct answer's displayed position across the whole bank,
// simulating a single session salt.
const salt = 'session-abc'
const hist = {}
let single = 0
all.forEach((q) => {
  if (q.type === 'multiple') return
  single++
  const shuffled = seededShuffle(q.choices, `${q.id}:${salt}`)
  const pos = shuffled.indexOf(q.correctAnswers[0])
  hist[pos] = (hist[pos] || 0) + 1
})
console.log('Single/case questions:', single)
console.log('Correct-answer displayed position distribution:', JSON.stringify(hist))

const positions = Object.keys(hist).length
const maxShare = Math.max(...Object.values(hist)) / single
console.log('Distinct positions used:', positions)
console.log('Largest single-position share:', (maxShare * 100).toFixed(1) + '%')

let ok = deterministic && positions >= 3 && maxShare < 0.5
console.log(ok ? 'SHUFFLE TEST PASSED' : 'SHUFFLE TEST FAILED')
process.exit(ok ? 0 : 1)
