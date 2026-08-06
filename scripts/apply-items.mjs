#!/usr/bin/env node
/**
 * Replaces WHOLE items, keyed by question id.
 *
 *   node scripts/apply-items.mjs <certId> <batch.mjs> [--apply]
 *
 * A batch file exports `ITEMS`, an array of complete item objects:
 *
 *   export const ITEMS = [
 *     { id: 'q-o1-1-37', objectiveId: 'o1-1', type: 'dropdown-sentence', ... },
 *   ]
 *
 * Why a separate script from `apply-explanations.mjs`: converting a choice item
 * to `dropdown-sentence` or `build-list` does not edit a field, it replaces the
 * item — `choices`/`correctAnswers` must go and `template`/`blanks` must appear.
 * A field-level editor cannot express a deletion, and hand-editing 45 blocks in
 * 11 files is where transcription errors live.
 *
 * Item blocks are spliced textually, located by scanning for the `  {` / `  },`
 * lines that bracket each element of the top-level array. The replacement is
 * serialized with `JSON.stringify(item, null, 2)` re-indented to the file's
 * 4-space item body: a whole-item replacement is a whole-item diff anyway, so
 * there is nothing to preserve by mimicking the inline-short-array style.
 *
 * Guards, all refusals rather than warnings:
 *   - the id must exist, exactly once, in the objective file its prefix names
 *   - `objectiveId` must be unchanged — a moved item silently reweights a domain
 *   - the correct answer must no longer be a full command line with parameters,
 *     which is the whole reason these conversions exist
 *   - the file must still parse as JSON before anything is written
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [certId, batchPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const APPLY = process.argv.includes('--apply')

if (!certId || !batchPath) {
  console.error('usage: node scripts/apply-items.mjs <certId> <batch.mjs> [--apply]')
  process.exit(1)
}

const QUIZ = path.join(process.cwd(), 'src/content', certId, 'quiz')
if (!fs.existsSync(QUIZ)) {
  console.error(`FATAL: no quiz directory at ${QUIZ}`)
  process.exit(1)
}

const { ITEMS } = await import(pathToFileURL(path.resolve(batchPath)).href)
if (!Array.isArray(ITEMS)) {
  console.error(`FATAL: ${batchPath} does not export an ITEMS array`)
  process.exit(1)
}

// Mirrors the rule in check-bank.mjs that these conversions exist to satisfy.
const isCommandLine = (o) =>
  /^\s*(az\s+[a-z][a-z-]+|(New|Set|Get|Update|Remove|Add|Enable|Disable|Grant|Revoke)-Az[A-Za-z]+)/.test(o) &&
  /\s(--[a-z][a-z-]{2,}|-[A-Z][A-Za-z]{2,})\b/.test(o)

const refused = []
const byId = new Map()
for (const item of ITEMS) {
  if (!item?.id) { refused.push('an item has no id'); continue }
  if (byId.has(item.id)) refused.push(`${item.id}: appears twice in the batch`)
  byId.set(item.id, item)
  if (!item.objectiveId) refused.push(`${item.id}: no objectiveId`)
  for (const a of item.correctAnswers ?? [])
    if (isCommandLine(a))
      refused.push(`${item.id}: correct answer is still a full command line — ${a.slice(0, 60)}…`)
}

const pending = new Map()
const applied = []
const notFound = new Set(byId.keys())

for (const file of fs.readdirSync(QUIZ).filter((f) => f.endsWith('.json'))) {
  const p = path.join(QUIZ, file)
  const lines = fs.readFileSync(p, 'utf8').split('\n')
  const out = []
  let touched = false

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== '  {') { out.push(lines[i]); continue }
    // Collect the block up to the closing `  }` or `  },` at item indent.
    let end = i
    while (end < lines.length && !/^ {2}\},?$/.test(lines[end])) end++
    const block = lines.slice(i, end + 1)
    const idLine = block.find((l) => /^ {4}"id": "/.test(l))
    const id = idLine ? /"id": "([^"]+)"/.exec(idLine)[1] : null
    const item = id ? byId.get(id) : undefined

    if (!item) { out.push(...block); i = end; continue }
    notFound.delete(id)
    const existingObjective = /"objectiveId": "([^"]+)"/.exec(block.join('\n'))?.[1]
    if (existingObjective && existingObjective !== item.objectiveId)
      refused.push(`${id}: objectiveId changed ${existingObjective} → ${item.objectiveId}`)

    const body = JSON.stringify(item, null, 2)
      .split('\n')
      .slice(1, -1) // drop the object's own braces; they come from the block form
      .map((l) => '  ' + l)
    const trailingComma = /,$/.test(lines[end])
    out.push('  {', ...body, trailingComma ? '  },' : '  }')
    applied.push(id)
    touched = true
    i = end
  }

  if (touched) pending.set(p, out.join('\n'))
}

for (const id of notFound) refused.push(`${id}: no such question in ${certId}`)

console.log(`${applied.length}/${ITEMS.length} items replaced`)
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
