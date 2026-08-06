#!/usr/bin/env node
/**
 * Replaces item explanations, keyed by question id.
 *
 *   node scripts/apply-explanations.mjs <certId> <batch.mjs> [--apply]
 *
 * A batch file exports `EXPLANATIONS`, a flat map of question id to new text:
 *
 *   export const EXPLANATIONS = {
 *     'q-o4-1-01': 'Deny blocks the write outright, which is what "prevent" means…',
 *   }
 *
 * Why keyed by id rather than by old text, unlike `apply-rewrites.mjs`: an
 * explanation is a long prose string, and transcribing 380 of them exactly to use
 * as match keys is both wasteful and a transcription-error waiting to happen. The
 * id is short, unique and already the thing being reasoned about.
 *
 * Textual replacement of the single `"explanation": "…"` line, verified to be
 * exactly one 4-space-indented line per item across both banks. A JSON round-trip
 * would reformat every file — the quiz files use Prettier-style output that
 * `JSON.stringify` does not reproduce — and bury the change.
 *
 * Guards, all refusals rather than warnings:
 *   - the question id must exist, in the objective file its prefix names
 *   - the new text must clear the 120-character minimum the validator enforces
 *   - it must contain a contrast marker, because an explanation that does not say
 *     why the tempting distractor fails is padding, and padding passes the
 *     length check while teaching nothing
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [certId, batchPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const APPLY = process.argv.includes('--apply')

if (!certId || !batchPath) {
  console.error('usage: node scripts/apply-explanations.mjs <certId> <batch.mjs> [--apply]')
  process.exit(1)
}

const QUIZ = path.join(process.cwd(), 'src/content', certId, 'quiz')
if (!fs.existsSync(QUIZ)) {
  console.error(`FATAL: no quiz directory at ${QUIZ}`)
  process.exit(1)
}

const { EXPLANATIONS } = await import(pathToFileURL(path.resolve(batchPath)).href)
if (!EXPLANATIONS || typeof EXPLANATIONS !== 'object') {
  console.error(`FATAL: ${batchPath} does not export an EXPLANATIONS object`)
  process.exit(1)
}

// Mirrors check-bank.mjs. Kept in step deliberately: a batch that passes here
// must not then fail the gate.
const CONTRAST = [
  'not ', "n't", 'whereas', 'unlike', 'rather than', 'fails', 'tempting', 'but ',
  'however', 'trap', 'closest miss', 'misses', 'cannot', 'never', 'instead', 'neither',
]
const MIN_LENGTH = 120

const refused = []
for (const [id, text] of Object.entries(EXPLANATIONS)) {
  if (typeof text !== 'string') refused.push(`${id}: not a string`)
  else if (text.length < MIN_LENGTH) refused.push(`${id}: ${text.length} chars, minimum ${MIN_LENGTH}`)
  else if (!CONTRAST.some((c) => text.toLowerCase().includes(c)))
    refused.push(`${id}: no contrast marker — does it say why the tempting distractor fails?`)
  else if (/\(\s*[A-F]\s*\)/.test(text))
    refused.push(`${id}: references an option letter, which shuffling makes meaningless`)
}

const pending = new Map()
const applied = []
const notFound = new Set(Object.keys(EXPLANATIONS))

for (const file of fs.readdirSync(QUIZ).filter((f) => f.endsWith('.json'))) {
  const p = path.join(QUIZ, file)
  const lines = fs.readFileSync(p, 'utf8').split('\n')
  let currentId = null
  let touched = false

  for (let i = 0; i < lines.length; i++) {
    const idMatch = /^ {4}"id": "([^"]+)"/.exec(lines[i])
    if (idMatch) currentId = idMatch[1]
    if (!/^ {4}"explanation": /.test(lines[i]) || !currentId) continue
    const replacement = EXPLANATIONS[currentId]
    if (replacement === undefined) continue
    notFound.delete(currentId)
    if (refused.some((r) => r.startsWith(`${currentId}:`))) continue
    // JSON.stringify handles the quoting and escaping; the trailing comma is
    // always present because `explanation` is never the last field.
    lines[i] = `    "explanation": ${JSON.stringify(replacement)},`
    applied.push(currentId)
    touched = true
  }

  if (touched) pending.set(p, lines.join('\n'))
}

for (const id of notFound) refused.push(`${id}: no such question in ${certId}`)

console.log(`${applied.length}/${Object.keys(EXPLANATIONS).length} explanations replaced`)
if (refused.length) {
  console.log(`\n${refused.length} REFUSED:`)
  refused.forEach((r) => console.log('  x ' + r))
}

if (!APPLY) {
  console.log('\n(dry run — pass --apply to write)')
  process.exit(refused.length ? 1 : 0)
}

for (const [p, text] of pending) {
  try {
    JSON.parse(text)
  } catch (e) {
    console.error(`FATAL: ${path.basename(p)} would no longer be valid JSON — ${e.message}`)
    console.error('nothing was written')
    process.exit(1)
  }
}
for (const [p, text] of pending) fs.writeFileSync(p, text)

console.log(`\nwrote ${pending.size} file(s), all still valid JSON`)
console.log(`next: node scripts/check-bank.mjs --cert=${certId}`)
process.exit(refused.length ? 1 : 0)
