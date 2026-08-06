#!/usr/bin/env node
/**
 * Replaces ONLY the option list of a choice item, keyed by question id.
 *
 *   node scripts/apply-choices.mjs <certId> <batch.mjs> [--apply]
 *
 * A batch file exports `CHOICES`, mapping an id to its new option set:
 *
 *   export const CHOICES = {
 *     'q-o4-2-01': {
 *       choices: ['…', '…', '…', '…'],
 *       correct: ['…'],
 *     },
 *   }
 *
 * Why not `apply-items.mjs`: that tool replaces the whole item, which is right
 * when a conversion changes the format but wrong here. The AZ-500 pass only
 * rebalances option lengths — the explanations were brought to standard in an
 * earlier pass — so a whole-item batch would restate 15 lines per item in order
 * to change 4, and any omitted field would be silently dropped. Narrowing the
 * tool to the field being changed removes that whole class of accident.
 *
 * Guards, all refusals rather than warnings:
 *   - the id must exist and the item must be a choice item
 *   - the option COUNT must be unchanged, so a 4-option item stays 4-option
 *   - every `correct` string must appear in `choices` — the bank keys answers by
 *     literal string, so a typo yields a permanently ungradable item
 *   - the length ratio must land within budget, and the longest option must NOT
 *     be a correct answer: the two things this pass exists to fix, checked here
 *     rather than discovered afterwards by check-bank
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [certId, batchPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const APPLY = process.argv.includes('--apply')
const RATIO_MAX = 1.6

if (!certId || !batchPath) {
  console.error('usage: node scripts/apply-choices.mjs <certId> <batch.mjs> [--apply]')
  process.exit(1)
}

const QUIZ = path.join(process.cwd(), 'src/content', certId, 'quiz')
if (!fs.existsSync(QUIZ)) {
  console.error(`FATAL: no quiz directory at ${QUIZ}`)
  process.exit(1)
}

const { CHOICES } = await import(pathToFileURL(path.resolve(batchPath)).href)
if (!CHOICES || typeof CHOICES !== 'object') {
  console.error(`FATAL: ${batchPath} does not export a CHOICES object`)
  process.exit(1)
}

const refused = []
for (const [id, spec] of Object.entries(CHOICES)) {
  const { choices, correct } = spec ?? {}
  if (!Array.isArray(choices) || !Array.isArray(correct)) {
    refused.push(`${id}: needs { choices: [], correct: [] }`)
    continue
  }
  if (new Set(choices).size !== choices.length) refused.push(`${id}: duplicate option text`)
  for (const c of correct)
    if (!choices.includes(c)) refused.push(`${id}: correct "${c.slice(0, 40)}…" is not among choices`)

  const lens = choices.map((c) => c.length)
  const max = Math.max(...lens)
  const ratio = max / Math.min(...lens)
  if (ratio > RATIO_MAX)
    refused.push(`${id}: ratio ${ratio.toFixed(2)} exceeds ${RATIO_MAX} (${max}/${Math.min(...lens)})`)
  if (correct.includes(choices[lens.indexOf(max)]))
    refused.push(`${id}: the longest option (${max}) is still a correct answer`)
}

/** Serializes an option array the way the quiz files are formatted. */
function renderArray(key, values, indent) {
  const pad = ' '.repeat(indent)
  const inline = `${pad}"${key}": [${values.map((v) => JSON.stringify(v)).join(', ')}],`
  if (inline.length <= 110) return [inline]
  return [
    `${pad}"${key}": [`,
    ...values.map((v) => `${pad}  ${JSON.stringify(v)},`),
    `${pad}],`,
  ].map((l, i, all) => (i === all.length - 2 ? l.replace(/,$/, '') : l))
}

const pending = new Map()
const applied = []
const notFound = new Set(Object.keys(CHOICES))

for (const file of fs.readdirSync(QUIZ).filter((f) => f.endsWith('.json'))) {
  const p = path.join(QUIZ, file)
  const items = JSON.parse(fs.readFileSync(p, 'utf8'))
  let touched = false
  for (const item of items) {
    const spec = CHOICES[item.id]
    if (!spec) continue
    notFound.delete(item.id)
    if (!Array.isArray(item.choices)) {
      refused.push(`${item.id}: is a ${item.type}, which has no choices to replace`)
      continue
    }
    if (item.choices.length !== spec.choices.length)
      refused.push(
        `${item.id}: option count ${item.choices.length} → ${spec.choices.length}, must be unchanged`,
      )
    if ((item.correctAnswers ?? []).length !== spec.correct.length)
      refused.push(
        `${item.id}: correct count ${(item.correctAnswers ?? []).length} → ${spec.correct.length},` +
          ` must be unchanged`,
      )
    item.choices = spec.choices
    item.correctAnswers = spec.correct
    applied.push(item.id)
    touched = true
  }
  if (touched) pending.set(p, items)
}

for (const id of notFound) refused.push(`${id}: no such question in ${certId}`)

console.log(`${applied.length}/${Object.keys(CHOICES).length} option sets replaced`)
if (refused.length) {
  console.log(`\n${refused.length} REFUSED:`)
  refused.forEach((r) => console.log('  x ' + r))
  console.log('\nnothing was written')
  process.exit(1)
}
if (!APPLY) {
  console.log('\n(dry run — pass --apply to write)')
  process.exit(0)
}

for (const [p, items] of pending) fs.writeFileSync(p, JSON.stringify(items, null, 2) + '\n')
console.log(`\nwrote ${pending.size} file(s)`)
console.log(`next: node scripts/check-bank.mjs --cert=${certId}`)
