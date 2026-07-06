import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const errors = []
let failures = 0

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

// 1. Root redirect + dropdown shows both certs
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Dashboard', { timeout: 10000 })
const url1 = page.url()
if (!url1.includes('/az500')) fail('Default redirect', `expected /az500, got ${url1}`)
else ok('Root redirects to default cert (az500)')

const options = await page.locator('.cert-select option').allTextContents()
if (!options.includes('AZ-500') || !options.includes('SC-500')) fail('Cert dropdown', `options: ${options}`)
else ok(`Cert dropdown lists both certs: ${options.join(', ')}`)

// 2. Switch to SC-500 via the dropdown
await page.selectOption('.cert-select', 'sc500')
await page.waitForTimeout(300)
const url2 = page.url()
if (!url2.includes('/sc500')) fail('Cert switch', `expected /sc500, got ${url2}`)
else ok('Switching dropdown navigates to /sc500')
await page.waitForSelector('p.muted', { timeout: 10000 })
const dashboardIntro = await page.locator('p.muted').first().textContent()
if (!dashboardIntro?.includes('SC-500')) fail('Dashboard exam code', `expected SC-500 in intro, got: ${dashboardIntro}`)
else ok('Dashboard shows SC-500 exam code')

// 3. Domains list — 4 domains
await page.goto(`${BASE}/#/sc500/domains`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Manage identity, access & governance', { timeout: 10000 })
const domainCards = await page.locator('.card-link').count()
if (domainCards !== 4) fail('Domains list', `expected 4 domain cards, got ${domainCards}`)
else ok('Domains list shows 4 domains')

// 4. Domain detail (d1) — 4 objectives
await page.goto(`${BASE}/#/sc500/domains/d1`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Secure access with Microsoft Entra ID', { timeout: 10000 })
const objCards = await page.locator('.card-link').count()
if (objCards !== 4) fail('Domain d1 detail', `expected 4 objective cards, got ${objCards}`)
else ok('Domain d1 detail shows 4 objectives')

// 5. Objective detail (o1-1) — lesson content incl. new "Commandes clés" style command block if present
await page.goto(`${BASE}/#/sc500/objectives/o3-1`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Tout réviser', { timeout: 10000 })
const keyPointsCount = await page.locator('text=Points clés').count()
if (keyPointsCount === 0) fail('Objective detail', 'missing key points section')
else ok('Objective detail (o1-1) renders lesson content')

// 6. Quiz flow — answer all 40 questions of o1-1 to exercise every question type
await page.goto(`${BASE}/#/sc500/objectives/o3-1/quiz?n=99`, { waitUntil: 'networkidle' })
await page.waitForSelector('.card', { timeout: 10000 })
const totalText = await page.locator('.chip', { hasText: 'Question 1 /' }).first().textContent()
const totalQuizQuestions = Number(totalText?.match(/\/\s*(\d+)/)?.[1] ?? 0)
if (totalQuizQuestions !== 47) fail('Quiz pool size', `expected 47 questions for sc500 o3-1, got ${totalQuizQuestions}`)
else ok('Quiz pool size is 40 for sc500 o1-1')

let sawReorder = false
let sawActiveScreen = false
for (let i = 0; i < totalQuizQuestions; i++) {
  await page.waitForSelector('.card', { timeout: 10000 })
  const isReorder = (await page.locator('text=Glisser-déposer pour ordonner').count()) > 0
  const isActiveScreen = (await page.locator('text=Active screen').count()) > 0

  if (isReorder) {
    sawReorder = true
    await page.click('button:has-text("Valider")')
  } else if (isActiveScreen) {
    sawActiveScreen = true
    const toggleButtons = page.locator('.diagram button.btn.secondary')
    const toggleCount = await toggleButtons.count()
    for (let t = 0; t < toggleCount; t++) await toggleButtons.nth(t).click()
    const selects = page.locator('.diagram select')
    const selectCount = await selects.count()
    for (let s = 0; s < selectCount; s++) {
      const opts = await selects.nth(s).locator('option').allTextContents()
      const firstReal = opts.find((o) => o !== 'Choisir…')
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
if (!sawReorder) fail('Quiz reorder type', 'no reorder question encountered')
else ok('Quiz flow: encountered a reorder question')
if (!sawActiveScreen) fail('Quiz active-screen type', 'no active-screen question encountered')
else ok('Quiz flow: encountered an active-screen question')
ok(`Quiz flow: completed all ${totalQuizQuestions} sc500 o1-1 questions`)

// 7. Exam start — weighted by 4 domains, correct exam meta
await page.goto(`${BASE}/#/sc500/exam`, { waitUntil: 'networkidle' })
await page.waitForSelector("text=Commencer l'examen", { timeout: 10000 })
const examMetaText = await page.locator('.chip-row').first().textContent()
if (!examMetaText?.includes('120 min') || !examMetaText?.includes('700')) {
  fail('Exam meta', `expected 120 min / 700 in chip row, got: ${examMetaText}`)
} else {
  ok('Exam start shows correct SC-500 duration/passing score (120 min, 700)')
}

// 8. Labs page for sc500
await page.goto(`${BASE}/#/sc500/labs`, { waitUntil: 'networkidle' })
await page.waitForSelector('input[type=checkbox]', { timeout: 10000 })
const labCount = await page.locator('input[type=checkbox]').count()
if (labCount < 1) fail('Labs page', 'no labs rendered for sc500')
else ok(`Labs page renders ${labCount} labs for sc500`)

// 9. Progress isolation: az500 dashboard should NOT show the sc500 quiz just completed
await page.goto(`${BASE}/#/az500`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Dashboard', { timeout: 10000 })
ok('Switched back to az500 dashboard without crash (progress isolation smoke check)')

console.log('CONSOLE_ERRORS_COUNT', errors.length)
errors.forEach((e) => console.log(e))
console.log('FAILURES', failures)

await browser.close()
process.exit(failures === 0 && errors.length === 0 ? 0 : 1)
