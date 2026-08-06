#!/usr/bin/env node
/**
 * End-to-end check of the review queue, over file:// against dist-single.
 *
 * The behaviour that matters is not "wrong answers show up" — it is that a
 * question **leaves** the queue once answered correctly. Keyed on "was ever
 * wrong" instead of "was wrong last time", the queue grows monotonically, the
 * count never falls and the list stops being a work list. That is the regression
 * this script exists to catch, and it cannot be caught by reading the code.
 *
 *   1. answer a quiz badly on purpose  -> attempts recorded
 *   2. the review page lists them, with the given answer beside the expected one
 *   3. replay, answering correctly this time
 *   4. those questions have left the queue
 *
 *   node scripts/verify-review-queue.mjs
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const URL = pathToFileURL(path.join(process.cwd(), 'dist-single/index.html')).href
const WAIT = { waitUntil: 'domcontentloaded', timeout: 20000 }
const CERT = 'sc500'
const OBJECTIVE = 'o1-1' // mostly single/multiple, so most draws are replayable

let browser
try {
  browser = await chromium.launch()
} catch (e) {
  console.log('SKIP: chromium not installed —', e.message.split('\n')[0])
  process.exit(0)
}

const page = await browser.newPage()
const problems = []
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push('console: ' + m.text())
})

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`)
}

/**
 * Answers `count` questions, always taking the FIRST option so most answers are
 * wrong on purpose.
 *
 * Only `.choice` items are counted, because step 3 replays by matching option
 * text and can only do that for a choice list. But a non-choice item must still
 * be ANSWERED rather than skipped: the quiz has no skip and "Valider" stays
 * disabled until the current question has a response, so breaking out on the
 * first reorder or grid item made the whole check depend on what the shuffled
 * draw happened to put first. It failed for that reason and not because the
 * queue was broken, which is the worst kind of harness.
 */
async function answerQuiz(url, count) {
  await page.goto(url, WAIT)
  await page.waitForTimeout(900)
  let answered = 0
  for (let i = 0; i < count; i++) {
    const choice = page.locator('.choice:not([disabled])').first()
    const isChoice = (await choice.count()) > 0
    if (isChoice) await choice.click({ timeout: 3000 }).catch(() => {})
    else if (!(await answerAnyOtherFormat())) break

    const validate = page.getByRole('button', { name: /^Valider/ }).first()
    if (!(await validate.count()) || !(await validate.isEnabled().catch(() => false))) break
    await validate.click({ timeout: 3000 }).catch(() => {})
    if (isChoice) answered++
    const next = page.getByRole('button', { name: /^(Question suivante|Voir le résultat)/ }).first()
    if (!(await next.count())) break
    await next.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(120)
  }
  return answered
}

/** Puts any response into a non-choice format, purely so the walk can advance. */
async function answerAnyOtherFormat() {
  for (const sel of ['.statement-pick:not([disabled])', '.build-available:not([disabled])']) {
    const el = page.locator(sel).first()
    if (await el.count()) {
      await el.click({ timeout: 2000 }).catch(() => {})
      return true
    }
  }
  for (const sel of ['.sentence-select', '.diagram select']) {
    const el = page.locator(sel).first()
    if (await el.count()) {
      await el.selectOption({ index: 1 }).catch(() => {})
      return true
    }
  }
  const toggle = page.locator('.diagram button').first()
  if (await toggle.count()) {
    await toggle.click({ timeout: 2000 }).catch(() => {})
    return true
  }
  // reorder seeds its own order, so it is already answerable; drag-match is the
  // only format with nothing clickable, and one pointer drag is enough.
  const src = page.locator('.match-source').first()
  const dst = page.locator('.match-target').first()
  if ((await src.count()) && (await dst.count())) {
    const a = await src.boundingBox()
    const b = await dst.boundingBox()
    if (a && b) {
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
      await page.mouse.down()
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
      await page.mouse.up()
      return true
    }
  }
  return (await page.getByRole('button', { name: /^Valider/ }).first().isEnabled().catch(() => false))
}

/** Scrapes the review page into [{ prompt, expected[] }]. */
async function readQueue() {
  await page.goto(`${URL}#/${CERT}/review`, WAIT)
  await page.waitForTimeout(1200)
  return page.evaluate(() =>
    [...document.querySelectorAll('.card')]
      .filter((card) => card.querySelector('.review-answer.good'))
      .map((card) => ({
        prompt: card.querySelector('p')?.textContent?.trim() ?? '',
        expected: [...card.querySelectorAll('.review-answer.good li')].map((li) => li.textContent.trim()),
        given: [...card.querySelectorAll('.review-answer.bad li')].map((li) => li.textContent.trim()),
      })),
  )
}

// ---- 1. answer badly on purpose.
// The count is opportunistic, not exact: the draw is shuffled, so how many of the
// ten are choice items varies. Non-choice items are answered too — they just do
// not count, because step 3 replays by matching option text. Two seeded attempts
// are enough to exercise everything below.
const answered = await answerQuiz(`${URL}#/${CERT}/objectives/${OBJECTIVE}/quiz?n=10`, 10)
check('1. quiz answered to seed attempts', answered >= 2, `${answered} questions answered`)

// ---- 2. the queue lists them, with both answers
const queue = await readQueue()
check('2. review page lists wrong answers', queue.length > 0, `${queue.length} in the queue`)
check(
  '   the given answer is shown beside the expected one',
  queue.every((q) => q.expected.length > 0) && queue.some((q) => q.given.length > 0),
  `${queue.filter((q) => q.given.length > 0).length}/${queue.length} with a recorded answer`,
)

if (queue.length === 0) {
  console.log('\ncannot continue without a queue')
  await browser.close()
  process.exit(1)
}

// ---- 3. replay, answering correctly this time
const before = queue.length
const expectedByPrompt = new Map(queue.map((q) => [q.prompt, q.expected]))

await page.goto(`${URL}#/${CERT}/review`, WAIT)
await page.waitForTimeout(1000)
await page.getByRole('link', { name: /Rejouer/ }).first().click({ timeout: 5000 })
await page.waitForTimeout(1200)

let replayed = 0
for (let i = 0; i < before + 2; i++) {
  const prompt = (await page.locator('h3').first().textContent().catch(() => null))?.trim()
  if (!prompt) break
  // Click every option whose text matches an expected answer, so multiple-response
  // items are answered fully rather than partially.
  const wanted = expectedByPrompt.get(prompt) ?? []
  let clicked = 0
  for (const line of wanted) {
    const option = page.locator('.choice', { hasText: line }).first()
    if (await option.count()) {
      await option.click({ timeout: 2500 }).catch(() => {})
      clicked++
    }
  }
  // An interactive item in the queue has no .choice to click. Answer it any way at
  // all so the walk keeps going, instead of dead-ending the whole replay on it —
  // only the choice items count towards `replayed`.
  if (!clicked) await answerAnyOtherFormat()
  const validate = page.getByRole('button', { name: /^Valider/ }).first()
  if ((await validate.count()) && (await validate.isEnabled().catch(() => false))) {
    await validate.click({ timeout: 3000 }).catch(() => {})
    if (clicked) replayed++
  }
  const next = page.getByRole('button', { name: /^(Question suivante|Voir le résultat)/ }).first()
  if (!(await next.count())) break
  await next.click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(120)
}
check('3. replay ran over the queue', replayed > 0, `${replayed} questions replayed`)

// ---- 4. the ones answered correctly have left the queue
const after = await readQueue()
check(
  '4. correctly answered questions LEAVE the queue',
  after.length < before,
  `${before} before, ${after.length} after`,
)

console.log('')
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):`)
  problems.slice(0, 8).forEach((p) => console.log('  ' + p))
  failures += problems.length
} else {
  console.log('no console or page errors')
}

await browser.close()
process.exit(failures ? 1 : 0)
