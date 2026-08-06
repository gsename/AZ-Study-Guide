/**
 * The file:// triad for the single-file build.
 *
 * A successful `build:single` is NOT a successful double-click: browsers block
 * <script type="module"> over file://, and a HashRouter app that renders at the
 * root can still fail on a per-certification route. Three things must hold:
 *
 *   1. renders at all                  (not a blank page)
 *   2. HashRouter navigates            (#/<certId>/... resolves)
 *   3. IndexedDB works                 (Dexie can open under the file:// origin)
 *
 * Then each interactive renderer is mounted, because a crash in one format
 * otherwise hides behind whichever formats the shuffled draw happened to pick.
 *
 *   node scripts/verify-file-protocol.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const URL = pathToFileURL(path.join(process.cwd(), 'dist-single/index.html')).href
// A file:// page with everything inlined never reliably reaches networkidle.
const WAIT = { waitUntil: 'domcontentloaded', timeout: 20000 }

let browser
try {
  browser = await chromium.launch()
} catch (e) {
  console.log('SKIP: chromium not installed —', e.message.split('\n')[0])
  console.log('      run: node node_modules/playwright/cli.js install chromium')
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

await page.goto(URL, WAIT)
await page.waitForTimeout(1000)
const home = await page.locator('body').innerText()
check('1. renders over file://', home.length > 200, `${home.length} chars of text`)

await page.goto(`${URL}#/sc500/objectives/o1-4/quiz?n=8`, WAIT)
await page.waitForTimeout(1000)
const header = (await page.locator('body').innerText()).match(/Question \d+ \/ \d+/)?.[0]
check('2. HashRouter reaches a per-cert quiz route', Boolean(header), header ?? 'no question header')

const dbOk = await page.evaluate(
  () =>
    new Promise((res) => {
      const r = indexedDB.open('triad-probe', 1)
      r.onsuccess = () => {
        r.result.close()
        res(true)
      }
      r.onerror = () => res(false)
    }),
)
check('3. IndexedDB opens under the file:// origin', dbOk)

/**
 * Puts *some* answer into whatever question is on screen, so the walk can move
 * on. Correctness is irrelevant here — this verifies renderers mount, not that
 * the bank is right, which is `check-bank.mjs`'s job.
 */
async function answerSomething(page) {
  // choices / statement-grid: a click is enough
  for (const sel of ['.choice:not([disabled])', '.statement-pick:not([disabled])', '.build-available:not([disabled])']) {
    const el = page.locator(sel).first()
    if (await el.count()) {
      await el.click({ timeout: 2000 }).catch(() => {})
      return
    }
  }
  // dropdown-sentence: pick the first real option of the first select
  const sel = page.locator('.sentence-select').first()
  if (await sel.count()) {
    await sel.selectOption({ index: 1 }).catch(() => {})
    return
  }
  // active-screen: its toggle/select rows live inside .diagram and carry none of
  // the classes above, so without this branch the walk dead-ends at the first
  // one — which is exactly why every format authored later looked unreachable.
  const asSelect = page.locator('.diagram select').first()
  if (await asSelect.count()) {
    await asSelect.selectOption({ index: 1 }).catch(() => {})
    return
  }
  const asToggle = page.locator('.diagram button').first()
  if (await asToggle.count()) {
    await asToggle.click({ timeout: 2000 }).catch(() => {})
    return
  }

  // drag-match: a genuine pointer drag from the pool onto the first target
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
    }
  }
}

/** Chip text each renderer puts in its header, keyed by authored type. */
const CHIPS = {
  'statement-grid': 'Grille Oui/Non',
  'build-list': 'Construire la liste',
  'drag-match': 'Glisser chaque élément',
  'dropdown-sentence': 'Compléter la phrase',
  reorder: 'Glisser-déposer pour ordonner',
  'active-screen': 'Active screen',
}

/**
 * Samples an objective's pool by drawing ONE question at a time and re-rolling.
 *
 * Walking a full set was the obvious approach and it was the wrong one: the quiz
 * has no skip, "Valider" stays disabled until the current question is answered,
 * and every format needs a different gesture — so the walk dead-ended on the
 * first format the driver could not answer and reported everything after it as
 * missing. Re-rolling needs no answer at all, so no format can block another.
 */
async function chipsBySampling(objectiveId, poolSize) {
  await page.goto(`${URL}#/sc500/objectives/${objectiveId}/quiz?n=${poolSize}`, WAIT)
  await page.waitForTimeout(700)
  const seen = new Set()
  let last = -1
  let stalledOn = null
  for (let i = 0; i < poolSize + 4; i++) {
    const text = await page.locator('body').innerText()
    for (const [type, chip] of Object.entries(CHIPS)) if (text.includes(chip)) seen.add(type)

    const at = Number(text.match(/Question (\d+) \//)?.[1] ?? -1)
    if (at === -1) break // set finished: the quiz header is gone
    if (at === last && i > 0) {
      // Do not fail silently: name the question the driver could not answer, or
      // the harness reports "format absent" when it means "format unreachable".
      stalledOn = `Q${at}: ${text.split('\n').find((l) => l.trim().length > 25)?.slice(0, 90) ?? '?'}`
      break
    }
    last = at

    await answerSomething(page)
    const validate = page.getByRole('button', { name: /^Valider/ }).first()
    if ((await validate.count()) && (await validate.isEnabled().catch(() => false)))
      await validate.click({ timeout: 2000 }).catch(() => {})
    const next = page.getByRole('button', { name: /^(Question suivante|Voir le résultat)/ }).first()
    if (!(await next.count())) continue
    await next.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(45)
  }
  console.log(
    `   ${objectiveId}: reached question ${last}/${poolSize}` +
      (stalledOn ? ` — STALLED, driver could not answer ${stalledOn}` : ''),
  )
  return seen
}

/**
 * Mounts ONE named question by seeding the review selection with just its id and
 * opening the replay route, which then draws exactly that item as question 1.
 *
 * Sampling the shuffled per-objective draw was the previous approach and it was
 * flaky by construction: whether a format appeared depended on the shuffle, and
 * a run that happened not to draw a `dropdown-sentence` reported the renderer as
 * broken. Seeding one id is deterministic and needs no answer at all, so no
 * format can block another either.
 */
async function mountsById(certId, questionId) {
  await page.goto(`${URL}#/${certId}/review`, WAIT)
  await page.waitForTimeout(300)
  await page.evaluate(
    ([cert, id]) =>
      sessionStorage.setItem(`study-guide-review-selection-${cert}`, JSON.stringify([id])),
    [certId, questionId],
  )
  await page.goto(`${URL}#/${certId}/review/quiz`, WAIT)
  await page.waitForTimeout(600)
  return page.locator('body').innerText()
}

console.log('\nInteractive renderers, each mounted by id through the replay route:')
// Read a real id per format out of the bank, so the harness cannot go stale when
// items are renumbered or converted.
const bank = []
for (const file of fs.readdirSync('src/content/sc500/quiz'))
  bank.push(...JSON.parse(fs.readFileSync(path.join('src/content/sc500/quiz', file), 'utf8')))

for (const type of ['statement-grid', 'build-list', 'drag-match', 'dropdown-sentence']) {
  const item = bank.find((q) => q.type === type)
  if (!item) {
    check(`   ${type} mounts`, false, 'no item of this type in the bank')
    continue
  }
  const text = await mountsById('sc500', item.id)
  check(`   ${type} mounts`, text.includes(CHIPS[type]), `${item.id} → chip "${CHIPS[type]}"`)
}

// ---- the meta notices, driven by the stored figures rather than by a hard-coded
// expectation: check-bank already proves those figures match what it measures, so
// asserting the UI follows them closes the path from bank to learner. A remediated
// bank that keeps warning about itself is as misleading as one that hides the tell.
for (const cert of ['az500', 'sc500']) {
  const { exam } = JSON.parse(
    fs.readFileSync(path.join('src/content', cert, 'domains.json'), 'utf8'),
  )
  const rawPass = (exam.passingScore / exam.scoreMax) * 100
  const shouldLeak = (exam.bankStatus?.freeScorePercent ?? 0) > rawPass - 20
  // Mirrors daysUntil(): the field is a DECLARED value, and SC-500 declares the
  // prose "Not announced by Microsoft". Unparseable means no countdown, by design.
  const declared = new Date(exam.retirementDate ?? '').getTime()
  const shouldRetire =
    !Number.isNaN(declared) && (declared - Date.now()) / 86_400_000 <= 400
  await page.goto(`${URL}#/${cert}`, WAIT)
  await page.waitForTimeout(900)
  const text = await page.locator('body').innerText()
  check(
    `   ${cert}: reliability notice shown only when the measured figure warrants it`,
    /sur cette banque/.test(text) === shouldLeak,
    `${exam.bankStatus?.freeScorePercent}% vs raw pass ${rawPass.toFixed(1)}% → ${shouldLeak ? 'shown' : 'hidden'}`,
  )
  check(
    `   ${cert}: retirement notice follows retirementDate`,
    /retire (AZ|SC)-\d+/.test(text) === shouldRetire,
    shouldRetire ? 'date present, notice shown' : 'no date, no notice',
  )
}

// The shuffled walk stays, as a smoke test that a whole objective can be played
// through — but it no longer decides whether a renderer is considered working.
const allSeen = new Set()
for (const [obj, draws] of [
  ['o1-4', 44],
  ['o2-3', 44],
]) {
  for (const t of await chipsBySampling(obj, draws)) allSeen.add(t)
}
console.log(`   (formats also met while walking: ${[...allSeen].join(', ') || 'none'})`)

console.log('')
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):`)
  problems.slice(0, 10).forEach((p) => console.log('  ' + p))
  failures += problems.length
} else {
  console.log('no console or page errors')
}

await browser.close()
process.exit(failures ? 1 : 0)
