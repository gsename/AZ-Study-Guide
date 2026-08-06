#!/usr/bin/env node
/**
 * Applies authored distractor rewrites to a certification's quiz files.
 *
 *   node scripts/apply-rewrites.mjs <certId> <batch.mjs>            # dry run
 *   node scripts/apply-rewrites.mjs <certId> <batch.mjs> --apply    # write
 *
 * A batch file exports `REWRITES`, an array of `[objectiveId, oldText, newText]`:
 *
 *   export const REWRITES = [
 *     ['o2-1', 'Rotate the account keys', 'Rotate the account keys on a schedule'],
 *   ]
 *
 * Why a script rather than hand edits: the option-length remediation touches
 * hundreds of items, and three guards below have each already caught a mistake
 * that would have been silent.
 *
 *   1. The old text must occur EXACTLY ONCE in the file. Zero matches means the
 *      string drifted; several means the edit would change an item nobody
 *      reviewed. Short option text like "Terms of use" is a substring of other
 *      options far more often than you expect — anchor on the JSON quotes, or on
 *      two adjacent option lines, to disambiguate.
 *
 *   2. The old text must not be a CORRECT answer. A correct answer is stored in
 *      both `choices` and `correctAnswers`; rewriting one occurrence leaves
 *      `correctAnswers.indexOf(choice) === -1`, which makes the item permanently
 *      ungradable with no error anywhere in the app.
 *
 *      `--allow-correct` lifts this for a batch that deliberately tightens
 *      correct answers, replacing BOTH occurrences together. It is needed
 *      because ~18% of items have a correct answer over 110 characters, where
 *      padding distractors up to match would produce four essay-length options —
 *      worse for the learner than the tell being fixed. For those, the
 *      justification belongs in the explanation, not in the option. Anything
 *      shortened this way MUST have that reasoning added to its explanation in
 *      the same batch, or the item becomes balanced and vague.
 *
 *   3. A rewrite must not SHORTEN its target by default. The rule is to pad
 *      distractors up to the correct answer, never to truncate the correct
 *      answer — truncating strips out the reasoning its explanation depends on
 *      and leaves a bank that is balanced and vague. Terminology items whose
 *      whole option set needs rebalancing are the legitimate exception: pass
 *      `--allow-shorten` for those batches.
 *
 * Formatting is preserved by editing text, not by round-tripping JSON: the quiz
 * files use Prettier-style output where short arrays stay on one line, which
 * `JSON.stringify` does not reproduce. A round trip would reformat every item in
 * the file and bury the actual change.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [certId, batchPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const APPLY = process.argv.includes('--apply')
const ALLOW_SHORTEN = process.argv.includes('--allow-shorten')
const ALLOW_CORRECT = process.argv.includes('--allow-correct')

if (!certId || !batchPath) {
  console.error('usage: node scripts/apply-rewrites.mjs <certId> <batch.mjs> [--apply] [--allow-shorten]')
  process.exit(1)
}

const QUIZ = path.join(process.cwd(), 'src/content', certId, 'quiz')
if (!fs.existsSync(QUIZ)) {
  console.error(`FATAL: no quiz directory at ${QUIZ}`)
  process.exit(1)
}

const { REWRITES } = await import(pathToFileURL(path.resolve(batchPath)).href)
if (!Array.isArray(REWRITES)) {
  console.error(`FATAL: ${batchPath} does not export a REWRITES array`)
  process.exit(1)
}

const pending = new Map()
const read = (objectiveId) => {
  if (!pending.has(objectiveId)) {
    const p = path.join(QUIZ, `${objectiveId}.json`)
    if (!fs.existsSync(p)) return null
    pending.set(objectiveId, fs.readFileSync(p, 'utf8'))
  }
  return pending.get(objectiveId)
}

let applied = 0
const refused = []
for (const [objectiveId, from, to] of REWRITES) {
  const text = read(objectiveId)
  if (text === null) {
    refused.push(`${objectiveId}: no such quiz file`)
    continue
  }
  const occurrences = text.split(from).length - 1
  const isCorrectAnswer = text
    .split('\n')
    .some((line) => line.includes('"correctAnswers"') && line.includes(from))

  if (isCorrectAnswer) {
    if (!ALLOW_CORRECT) {
      refused.push(`${objectiveId}: "${from.slice(0, 60)}…" is a CORRECT answer — pass --allow-correct to tighten it`)
      continue
    }
    // A correct answer lives in `choices` AND `correctAnswers`. Exactly two, or
    // the item is already malformed and this is not the place to discover that.
    if (occurrences !== 2) {
      refused.push(
        `${objectiveId}: correct answer "${from.slice(0, 50)}…" appears ${occurrences} time(s), expected 2`,
      )
      continue
    }
    pending.set(objectiveId, text.split(from).join(to))
    applied++
    continue
  }

  if (occurrences !== 1) {
    refused.push(`${objectiveId}: ${occurrences} occurrence(s) of "${from.slice(0, 60)}…"`)
    continue
  }
  if (to.length < from.length && !ALLOW_SHORTEN) {
    refused.push(
      `${objectiveId}: shortens a distractor (${from.length} -> ${to.length}) — pass --allow-shorten if the whole option set is being rebalanced`,
    )
    continue
  }
  pending.set(objectiveId, text.replace(from, to))
  applied++
}

console.log(`${applied}/${REWRITES.length} rewrites applied cleanly`)
if (refused.length) {
  console.log(`\n${refused.length} REFUSED:`)
  refused.forEach((r) => console.log('  x ' + r))
}

if (!APPLY) {
  console.log('\n(dry run — pass --apply to write)')
  process.exit(refused.length ? 1 : 0)
}

// Parse before writing: a malformed edit must fail loudly here rather than
// break the app's content import at build time.
for (const [objectiveId, text] of pending) {
  try {
    JSON.parse(text)
  } catch (e) {
    console.error(`FATAL: ${objectiveId}.json would no longer be valid JSON — ${e.message}`)
    console.error('nothing was written')
    process.exit(1)
  }
}
for (const [objectiveId, text] of pending) {
  fs.writeFileSync(path.join(QUIZ, `${objectiveId}.json`), text)
}
console.log(`\nwrote ${pending.size} file(s), all still valid JSON`)
console.log(`next: node scripts/check-bank.mjs --cert=${certId}`)
process.exit(refused.length ? 1 : 0)
