#!/usr/bin/env node
/**
 * Prints a concrete remediation plan for one quiz file's option-length tells.
 *
 *   node scripts/show-tells.mjs sc500 o2-1
 *   node scripts/show-tells.mjs sc500 o2-1 --brief
 *
 * Two defects are reported together because they are fixed by the same edit:
 *
 *   ratio       max option length / min option length must be <= 1.6
 *   LONGEST     the correct answer must not be the longest option, since that
 *               is the one tell runtime choice-shuffling cannot neutralise
 *
 * The plan is computed rather than left as arithmetic for the author, because
 * lengthening one distractor past the correct answer RAISES the maximum, which
 * in turn raises the minimum every other option must clear. Doing that by hand,
 * item by item, is where the mistakes come from.
 *
 * The fix is always to pad a distractor with real technical qualification until
 * it is as specific as the correct answer — never to truncate the correct
 * answer, which strips out the reasoning its explanation depends on and leaves a
 * bank that is balanced and vague.
 */
import fs from 'node:fs'
import path from 'node:path'

const [certId, objectiveId] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const BRIEF = process.argv.includes('--brief')
if (!certId || !objectiveId) {
  console.error('usage: node scripts/show-tells.mjs <certId> <objectiveId> [--brief]')
  process.exit(1)
}

const RATIO_MAX = 1.6
const file = path.join('src/content', certId, 'quiz', `${objectiveId}.json`)
const items = JSON.parse(fs.readFileSync(file, 'utf8'))

/** Yes/No items cannot be length-balanced and carry no such tell. */
const isBoolean = (choices) =>
  choices.length === 2 && choices.every((c) => /^(yes|no)$/i.test(c.trim()))

const rows = []
for (const q of items) {
  if (!q.choices || !q.correctAnswers || isBoolean(q.choices)) continue

  const lens = q.choices.map((c) => c.length)
  const correct = new Set(q.correctAnswers)
  const maxLen = Math.max(...lens)
  const minLen = Math.min(...lens)
  const ratio = maxLen / minLen
  const longestIsCorrect = correct.has(q.choices[lens.indexOf(maxLen)])
  if (ratio <= RATIO_MAX && !longestIsCorrect) continue

  // The longest correct answer sets the bar: one distractor must clear it.
  const longestCorrect = Math.max(...q.choices.filter((c) => correct.has(c)).map((c) => c.length))
  const lead = longestIsCorrect ? longestCorrect + 2 : maxLen
  // Every option must then clear the new maximum divided by the ratio budget.
  const floor = Math.ceil(lead / RATIO_MAX)

  const distractors = q.choices
    .map((c, i) => ({ text: c, len: lens[i] }))
    .filter(({ text }) => !correct.has(text))
    .sort((a, b) => b.len - a.len)

  rows.push({ q, lens, correct, ratio, longestIsCorrect, longestCorrect, lead, floor, distractors })
}

rows.sort((a, b) => Number(b.longestIsCorrect) - Number(a.longestIsCorrect) || b.ratio - a.ratio)

console.log(`${file} — ${items.length} items, ${rows.length} needing work\n`)

for (const r of rows) {
  const { q, lens, correct, ratio, longestIsCorrect, longestCorrect, lead, floor, distractors } = r
  console.log(
    `${q.id}  ratio ${ratio.toFixed(2)}${longestIsCorrect ? '  LONGEST=correct' : ''}` +
      `  ·  correct ${longestCorrect}  ·  PLAN: lead >= ${lead}, every option >= ${floor}`,
  )
  if (!BRIEF) console.log(`  Q: ${q.prompt}`)

  // The longest distractor is the natural lead: it is already the closest.
  const leadText = distractors[0]?.text
  q.choices.forEach((c, i) => {
    if (correct.has(c)) {
      console.log(`  * [${String(lens[i]).padStart(3)}] ${BRIEF ? c.slice(0, 70) : c}`)
      return
    }
    const need = c === leadText ? lead - lens[i] : floor - lens[i]
    const label = c === leadText ? 'LEAD' : 'pad '
    const todo = need > 0 ? `  <-- ${label} +${need}` : ''
    console.log(`    [${String(lens[i]).padStart(3)}] ${BRIEF ? c.slice(0, 70) : c}${todo}`)
  })
  console.log('')
}

const leaking = rows.filter((r) => r.longestIsCorrect).length
console.log(`${leaking}/${rows.length} have the correct answer as the longest option.`)
console.log('LEAD = the distractor to push past the correct answer. pad = bring up to the ratio floor.')
