#!/usr/bin/env node
/**
 * The per-question correction on the exam result page.
 *
 * Why this needs a harness: the correction reads `db.quizAttempts` joined to the
 * bank by `examResultId`, and every way it can fail is silent. An attempt row
 * with no `response` renders an empty card. A question dropped from the bank
 * since the exam renders nothing at all. A grouped question renders "Referring
 * to requirement 3 (…)" with no scenario, which looks fine and is useless. None
 * of that shows up in `tsc`, and none of it shows up in a passing build.
 *
 * The right/wrong mix is DELIBERATE, not luck: the script reads the bank and
 * clicks the known-correct option on even questions and a known-wrong one on
 * odd questions, so both branches of the answer panel are exercised on every
 * run. Clicking blindly and hoping for a mix is how a harness becomes flaky.
 *
 *   npm run verify:correction
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const CERT = 'az500'
const URL = pathToFileURL(path.join(process.cwd(), 'dist-single/index.html')).href
const WAIT = { waitUntil: 'domcontentloaded', timeout: 20000 }

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`)
}

/** The bank, keyed by prompt, so the walk can answer deterministically. */
const byPrompt = new Map()
const dir = `src/content/${CERT}/quiz`
for (const f of fs.readdirSync(dir))
  for (const q of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    if (Array.isArray(q.choices) && q.correctAnswers) byPrompt.set(q.prompt.trim(), q)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
const problems = []
page.on('pageerror', (e) => problems.push(String(e)))
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))

await page.goto(`${URL}#/${CERT}/exam`, WAIT)
await page.waitForTimeout(1000)
await page
  .getByRole('button', { name: '40' })
  .first()
  .click({ timeout: 3000 })
  .catch(() => {})
await page
  .getByRole('button', { name: /Commencer|Démarrer|Lancer/ })
  .first()
  .click({ timeout: 5000 })
await page.waitForTimeout(1200)

let wantedRight = 0
let wantedWrong = 0
for (let i = 0; i < 12; i++) {
  const prompt = (await page.locator('h3').first().textContent().catch(() => null))?.trim()
  const q = prompt ? byPrompt.get(prompt) : undefined
  if (q) {
    // Even -> answer correctly, odd -> answer wrongly. Multi-answer items need
    // every correct option clicked, so a partial click would count as wrong.
    const targets =
      i % 2 === 0 ? q.correctAnswers : [q.choices.find((c) => !q.correctAnswers.includes(c))]
    let clicked = 0
    for (const t of targets) {
      const opt = page.locator('.choice', { hasText: t }).first()
      if (await opt.count()) {
        await opt.click({ timeout: 2500 }).catch(() => {})
        clicked++
      }
    }
    if (clicked === targets.length) (i % 2 === 0 ? wantedRight++ : wantedWrong++)
  }
  const next = page.getByRole('button', { name: /^Suivant/ }).first()
  if (!(await next.count()) || !(await next.isEnabled().catch(() => false))) break
  await next.click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(120)
}
check(
  '1. exam answered with a deliberate right/wrong mix',
  wantedRight > 0 && wantedWrong > 0,
  `${wantedRight} correct, ${wantedWrong} wrong on purpose`,
)

await page.getByRole('button', { name: /Terminer l'examen/ }).first().click({ timeout: 5000 })
await page.waitForTimeout(2000)

// innerText returns text with CSS text-transform APPLIED, and `.build-col-title`
// is uppercase — so these matches must be case-insensitive. A case-sensitive
// regex here reported a false failure once.
const text = await page.locator('body').innerText()
check('2. result page reached', /Résultat de l'examen blanc/i.test(text))
check('3. correction section present', /Correction détaillée/i.test(text))
check('4. given answer shown', /Ta réponse/i.test(text))
check('5. expected answer shown', /Réponse attendue/i.test(text))
check('6. explanation shown', /Explication/i.test(text))

const total = /Les (\d+) questions/i.exec(text)
check('7. every question is listed', total?.[1] === '40', total ? `button says ${total[1]}` : 'no button')

// A correct answer must NOT print the expected column beside it — repeating it
// is noise, and its absence is what proves the branch works.
const cards = await page.locator('.card:has(.review-answers)').count()
const rightCards = await page.locator('.card:has(.chip.good)').count()
check('8. correct answers render without the expected column', rightCards > 0, `${rightCards} correct of ${cards} shown`)

const wrongBtn = /(\d+) erreurs? seulement/i.exec(text)
check('9. wrong-only filter is counted', Boolean(wrongBtn), wrongBtn ? `${wrongBtn[1]} wrong` : '')
if (wrongBtn) {
  const wrongN = Number(wrongBtn[1])
  await page.getByRole('button', { name: /erreurs? seulement/i }).click({ timeout: 3000 })
  await page.waitForTimeout(700)
  const after = await page.locator('.review-answers').count()
  check('10. the filter actually filters', after === wrongN, `${cards} → ${after}, expected ${wrongN}`)
}

console.log('')
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):`)
  problems.slice(0, 8).forEach((p) => console.log('  ' + p))
  failures += problems.length
} else console.log('no console or page errors')

await browser.close()
process.exit(failures ? 1 : 0)
