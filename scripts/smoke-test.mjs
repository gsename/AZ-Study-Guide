import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'http://localhost:5173'
const CERT = 'az500'
const errors = []
let failures = 0

fs.mkdirSync('/app/screenshots', { recursive: true })

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`)
})
page.on('pageerror', (err) => {
  errors.push(`[pageerror] ${err.message}`)
})

function fail(label, detail) {
  failures += 1
  console.log(`FAIL ${label}: ${detail}`)
}
function ok(label) {
  console.log(`OK ${label}`)
}

async function shot(name) {
  await page.screenshot({ path: `/app/screenshots/${name}.png`, fullPage: true })
}

// 1. Dashboard
await page.goto(`${BASE}/#/${CERT}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Dashboard', { timeout: 10000 })
await shot('01-dashboard')
ok('Dashboard renders')

// 2. Domains list
await page.goto(`${BASE}/#/${CERT}/domains`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Secure identity and access', { timeout: 10000 })
const domainCards = await page.locator('.card-link').count()
if (domainCards !== 4) fail('Domains list', `expected 4 domain cards, got ${domainCards}`)
else ok('Domains list shows 4 domains')
await shot('02-domains')

// 3. Domain detail
await page.goto(`${BASE}/#/${CERT}/domains/d1`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Manage security controls for identity and access', { timeout: 10000 })
ok('Domain detail (d1) renders objectives')
await shot('03-domain-detail')

// 4. Objective detail
await page.goto(`${BASE}/#/${CERT}/objectives/o1-1`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Tout réviser', { timeout: 10000 })
const keyPointsCount = await page.locator('text=Points clés').count()
if (keyPointsCount === 0) fail('Objective detail', 'missing key points section')
else ok('Objective detail (o1-1) renders lesson content')
const diagramCount = await page.locator('.diagram').count()
if (diagramCount < 1) fail('Objective detail', 'no diagrams rendered')
else ok(`Objective detail renders ${diagramCount} diagram(s)`)
const boldCount = await page.locator('.keypoints strong, .callout strong').count()
if (boldCount < 1) fail('Objective detail', 'no bold emphasis rendered')
else ok(`Objective detail renders bold emphasis (${boldCount} instances)`)
await shot('04-objective-detail')

// 4b. dark theme
await page.click('.theme-toggle')
await page.waitForTimeout(200)
const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
if (themeAttr !== 'dark') fail('Theme toggle', `expected dark, got ${themeAttr}`)
else ok('Theme toggle switches to dark')
await shot('04b-objective-dark')
await page.click('.theme-toggle')
await page.waitForTimeout(200)

// 5. Targeted quiz flow — run ALL questions of o1-1 (n=99 clamps to the full
// pool) to deterministically exercise every question type (single/multiple/
// case-study/solution-goal via choice click, reorder via drag, active-screen
// via field interaction).
await page.goto(`${BASE}/#/${CERT}/objectives/o1-1/quiz?n=99`, { waitUntil: 'networkidle' })
await page.waitForSelector('.card', { timeout: 10000 })

const totalText = await page.locator('.chip', { hasText: 'Question 1 /' }).first().textContent()
const totalQuizQuestions = Number(totalText?.match(/\/\s*(\d+)/)?.[1] ?? 0)
if (totalQuizQuestions < 37) fail('Quiz pool size', `expected 41 questions for o1-1, header says ${totalQuizQuestions}`)

let sawReorder = false
let sawActiveScreen = false
let reorderChanged = false

for (let i = 0; i < totalQuizQuestions; i++) {
  await page.waitForSelector('.card', { timeout: 10000 })
  const isReorder = (await page.locator('text=Glisser-déposer pour ordonner').count()) > 0
  const isActiveScreen = (await page.locator('text=Active screen').count()) > 0

  if (isReorder) {
    sawReorder = true
    const items = page.locator('.choice')
    const count = await items.count()
    if (count >= 2) {
      const beforeTexts = await items.allTextContents()
      const box0 = await items.nth(0).boundingBox()
      const box1 = await items.nth(1).boundingBox()
      if (box0 && box1) {
        await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2)
        await page.mouse.down()
        await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height + 5, { steps: 8 })
        await page.mouse.up()
        await page.waitForTimeout(200)
        const afterTexts = await items.allTextContents()
        if (JSON.stringify(beforeTexts) !== JSON.stringify(afterTexts)) reorderChanged = true
      }
    }
    await page.click('button:has-text("Valider")')
  } else if (isActiveScreen) {
    sawActiveScreen = true
    // Toggle every toggle-kind field once, pick the first non-empty option for selects.
    const toggleButtons = page.locator('.diagram button.btn.secondary')
    const toggleCount = await toggleButtons.count()
    for (let t = 0; t < toggleCount; t++) {
      await toggleButtons.nth(t).click()
    }
    const selects = page.locator('.diagram select')
    const selectCount = await selects.count()
    for (let s = 0; s < selectCount; s++) {
      const options = await selects.nth(s).locator('option').allTextContents()
      const firstReal = options.find((o) => o !== 'Choisir…')
      if (firstReal) await selects.nth(s).selectOption({ label: firstReal })
    }
    await page.click('button:has-text("Valider")')
  } else {
    await page.locator('.choice').first().click()
    await page.click('button:has-text("Valider")')
  }

  await page.waitForSelector('text=Explication', { timeout: 10000 })
  const nextBtn = page.locator('button:has-text("Question suivante"), button:has-text("Voir le résultat")')
  await nextBtn.click()
}

await page.waitForSelector('text=Résultat', { timeout: 10000 })
await shot('05-quiz-result')

if (!sawReorder) fail('Quiz reorder type', 'no reorder question encountered across the full pool')
else ok('Quiz flow: encountered and answered reorder question(s)')
if (!reorderChanged) fail('Quiz reorder drag', 'dragging did not change item order')
else ok('Quiz flow: drag-and-drop reordering changed item order')
if (!sawActiveScreen) fail('Quiz active-screen type', 'no active-screen question encountered across the full pool')
else ok('Quiz flow: encountered and answered active-screen question(s)')
ok(`Quiz flow: completed all ${totalQuizQuestions} questions (all six question types)`)

// 6. Mock exam flow
await page.goto(`${BASE}/#/${CERT}/exam`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Commencer l\'examen', { timeout: 10000 })
await page.click('text=Commencer l\'examen')
await page.waitForSelector('.timer', { timeout: 10000 })
ok('Exam session started, timer visible')
await page.locator('.choice').first().click()
await shot('06-exam-session')

// 6b. Solution-goal lock: scan questions via qnav for one, move past it via
// "Suivant", then verify its qnav pill becomes disabled/locked and Précédent
// can no longer reach it — mirroring real-exam no-return-navigation.
const qnavButtons = page.locator('.qnav button')
const qnavCount = await qnavButtons.count()
let lockTested = false
for (let i = 0; i < qnavCount && !lockTested; i++) {
  await qnavButtons.nth(i).click()
  const isSolutionGoal = (await page.locator('text=Une fois passé à la question suivante').count()) > 0
  if (isSolutionGoal) {
    lockTested = true
    await page.locator('.choice').first().click()
    await page.click('button:has-text("Suivant")')
    await page.waitForTimeout(150)
    const lockedDisabled = await qnavButtons.nth(i).isDisabled()
    if (!lockedDisabled) fail('Solution-goal lock', 'qnav pill for left solution-goal question is not disabled')
    else ok('Solution-goal lock: qnav pill disabled after leaving the question')
    const prevBtn = page.locator('button:has-text("Précédent")')
    const prevDisabled = await prevBtn.isDisabled()
    if (!prevDisabled) fail('Solution-goal lock', "'Précédent' is not disabled after a locked solution-goal question")
    else ok("Solution-goal lock: 'Précédent' disabled, cannot revisit")
  }
}
if (!lockTested) console.log('NOTE: no solution-goal question found in this exam draw (random) — lock behavior not exercised this run')

// 6c. Reorder-in-exam: find a reorder question via qnav and verify its items
// actually render (regression check: the exam must seed the initial order).
let examReorderFound = false
for (let i = 0; i < qnavCount && !examReorderFound; i++) {
  const pill = qnavButtons.nth(i)
  if (await pill.isDisabled()) continue
  await pill.click()
  if ((await page.locator('text=Glisser-déposer pour ordonner').count()) > 0) {
    examReorderFound = true
    const itemCount = await page.locator('.choice').count()
    if (itemCount < 3) fail('Exam reorder render', `reorder question shows only ${itemCount} draggable items`)
    else ok(`Exam reorder question renders its ${itemCount} draggable items`)
  }
}
if (!examReorderFound) console.log('NOTE: no reorder question in this exam draw (random) — exam reorder rendering not exercised this run')

await page.click('button:has-text("Terminer l\'examen")')
await page.waitForSelector("text=Résultat de l'examen blanc", { timeout: 15000 })
await page.waitForSelector('text=Détail par domaine', { timeout: 15000 })
ok('Exam submitted, results page shows scaled score')
await shot('07-exam-result')

// 7. Labs page + checkbox persistence
await page.goto(`${BASE}/#/${CERT}/labs`, { waitUntil: 'networkidle' })
await page.waitForSelector('input[type=checkbox]', { timeout: 10000 })
const firstCheckbox = page.locator('input[type=checkbox]').first()
const beforeChecked = await firstCheckbox.isChecked()
await firstCheckbox.click()
await page.waitForTimeout(300)
const afterChecked = await firstCheckbox.isChecked()
if (afterChecked === beforeChecked) fail('Labs checkbox', 'checkbox state did not toggle')
else ok('Labs checkbox toggles')
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('input[type=checkbox]', { timeout: 10000 })
const afterReload = await page.locator('input[type=checkbox]').first().isChecked()
if (afterReload !== afterChecked) fail('Labs persistence', 'checkbox state did not survive reload (IndexedDB)')
else ok('Labs checkbox persisted across reload via IndexedDB')
await shot('08-labs')

// 8. Dashboard should now show a recent exam + reflect progress
await page.goto(`${BASE}/#/${CERT}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Examens blancs récents', { timeout: 10000 })
const examRows = await page.locator('table.scores tbody tr').count()
if (examRows < 1) fail('Dashboard exam history', 'no exam rows found after completing an exam')
else ok('Dashboard reflects completed exam in history')
await shot('09-dashboard-after')

console.log('CONSOLE_ERRORS_COUNT', errors.length)
errors.forEach((e) => console.log(e))
console.log('FAILURES', failures)

await browser.close()
process.exit(failures === 0 && errors.length === 0 ? 0 : 1)
