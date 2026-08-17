#!/usr/bin/env node
/**
 * APPENDS new items to the end of their objective file.
 *
 *   node scripts/add-items.mjs <certId> <batch.mjs> [--apply]
 *
 * A batch file exports `ITEMS`, an array of complete item objects, exactly as
 * `apply-items.mjs` takes them:
 *
 *   export const ITEMS = [
 *     { id: 'q-o4-1-42', objectiveId: 'o4-1', type: 'single', ... },
 *   ]
 *
 * Why a separate script from `apply-items.mjs`: that one is a REPLACER. It tracks
 * every batch id it failed to locate and refuses the run with "no such question",
 * so it cannot create anything. The two refusals are exact opposites — one needs
 * the id to exist, this one needs it not to — and folding both into one script
 * would mean a flag that turns a guard off. A typo'd id would then silently
 * append a duplicate instead of being caught.
 *
 * Appending is a smaller operation than replacing: the new blocks are serialized
 * with `JSON.stringify(item, null, 2)`, re-indented to the file's 4-space item
 * body, and spliced in before the closing `]`. No existing line is touched.
 *
 * Guards, all refusals rather than warnings:
 *   - the id must NOT already exist anywhere in the certification
 *   - the id prefix must name the objective file it is being added to, and
 *     `objectiveId` must agree with it — a misfiled item silently reweights a
 *     domain in the exam draw, which allocates by domain weight
 *   - an id must not appear twice in the batch
 *   - the file must still parse as JSON before anything is written
 *
 * Deliberately NOT duplicated here: the option-length tell (ratio, longest option
 * must not be correct). `check-bank.mjs --cert=<id> --no-legacy` is the authority
 * on that and now exits non-zero, so the cycle is add -> check-bank -> fix. A
 * second copy of the rule would be a second thing to keep in sync.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [certId, batchPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const APPLY = process.argv.includes('--apply')

if (!certId || !batchPath) {
  console.error('usage: node scripts/add-items.mjs <certId> <batch.mjs> [--apply]')
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

const refused = []

/* Every id already in the bank, so a collision is caught wherever it lives. */
const existing = new Map()
for (const file of fs.readdirSync(QUIZ).filter((f) => f.endsWith('.json')))
  for (const q of JSON.parse(fs.readFileSync(path.join(QUIZ, file), 'utf8')))
    existing.set(q.id, file)

/* Batch validation, before any file is opened for writing. */
const seen = new Set()
const byFile = new Map()

for (const item of ITEMS) {
  const at = item?.id ?? '(an item with no id)'
  if (!item?.id) {
    refused.push('an item has no id')
    continue
  }
  if (seen.has(item.id)) {
    refused.push(`${at}: appears twice in the batch`)
    continue
  }
  seen.add(item.id)

  if (existing.has(item.id)) {
    refused.push(`${at}: already exists in ${existing.get(item.id)} — this script only adds`)
    continue
  }
  if (!item.objectiveId) {
    refused.push(`${at}: no objectiveId`)
    continue
  }

  // `q-o4-1-42` -> `o4-1`. The id carries the objective, so the two must agree;
  // otherwise the item lands in a file whose domain weight it then distorts.
  const fromId = /^q-(o\d+-\d+)-\d+$/.exec(item.id)?.[1]
  if (!fromId) {
    refused.push(`${at}: id does not match q-o<domain>-<objective>-<n>`)
    continue
  }
  if (fromId !== item.objectiveId) {
    refused.push(`${at}: id says ${fromId} but objectiveId is ${item.objectiveId}`)
    continue
  }

  const file = `${fromId}.json`
  if (!fs.existsSync(path.join(QUIZ, file))) {
    refused.push(`${at}: no such objective file ${file}`)
    continue
  }
  if (!byFile.has(file)) byFile.set(file, [])
  byFile.get(file).push(item)
}

/* Build the new file contents. Nothing is written until every batch item passed. */
const pending = new Map()

for (const [file, items] of byFile) {
  const p = path.join(QUIZ, file)
  const lines = fs.readFileSync(p, 'utf8').replace(/\n$/, '').split('\n')

  // The array closes on the last `]` at column 0; everything before it is items.
  let close = lines.length - 1
  while (close >= 0 && lines[close].trim() !== ']') close--
  if (close < 0) {
    refused.push(`${file}: no closing ] found at the top level`)
    continue
  }

  // The previous item must end with a comma once something follows it.
  let last = close - 1
  while (last >= 0 && lines[last].trim() === '') last--
  if (last >= 0 && /^ {2}\}$/.test(lines[last])) lines[last] = '  },'

  const blocks = items.flatMap((item, idx) => {
    const body = JSON.stringify(item, null, 2)
      .split('\n')
      .slice(1, -1) // drop the object's own braces; they come from the block form
      .map((l) => '  ' + l)
    return ['  {', ...body, idx === items.length - 1 ? '  }' : '  },']
  })

  pending.set(p, [...lines.slice(0, close), ...blocks, ...lines.slice(close)].join('\n') + '\n')
}

const total = [...byFile.values()].reduce((n, a) => n + a.length, 0)
console.log(`${total}/${ITEMS.length} items ready to add across ${byFile.size} file(s)`)
for (const [file, items] of byFile)
  console.log(`  ${file}: +${items.length} (${items.map((i) => i.id).join(', ')})`)

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
    console.error(`\nFATAL: ${path.basename(p)} would no longer be valid JSON — ${e.message}`)
    console.error('nothing was written')
    process.exit(1)
  }
}

for (const [p, text] of pending) fs.writeFileSync(p, text)
console.log(`\nwrote ${pending.size} file(s), all still valid JSON`)
console.log(`next: node scripts/check-bank.mjs --cert=${certId} --no-legacy`)
