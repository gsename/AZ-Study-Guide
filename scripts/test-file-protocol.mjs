import { chromium } from 'playwright'
import path from 'node:path'

const distIndex = path.resolve(process.argv[2] ?? '/app/dist-single/index.html')
const fileUrl = `file://${distIndex}`

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`))

console.log('Opening', fileUrl)
await page.goto(fileUrl, { waitUntil: 'networkidle' })

const title = await page.title()
console.log('Title:', title)

try {
  await page.waitForSelector('text=Dashboard', { timeout: 5000 })
  console.log('OK: Dashboard shell rendered via file://')
} catch {
  console.log('FAIL: Dashboard did not render via file://')
  console.log('Body HTML snippet:', (await page.content()).slice(0, 500))
}

// Try navigating (HashRouter) to domains
try {
  await page.click('text=Domaines')
  await page.waitForSelector('text=Secure identity and access', { timeout: 5000 })
  console.log('OK: HashRouter navigation works via file://')
} catch (e) {
  console.log('FAIL: navigation broke via file://', e.message)
}

// Try IndexedDB: go to labs, toggle a checkbox, reload, check persistence
let idbWorks = false
try {
  await page.goto(`${fileUrl}#/labs`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[type=checkbox]', { timeout: 5000 })
  await page.locator('input[type=checkbox]').first().click()
  await page.waitForTimeout(300)
  const before = await page.locator('input[type=checkbox]').first().isChecked()
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('input[type=checkbox]', { timeout: 5000 })
  const after = await page.locator('input[type=checkbox]').first().isChecked()
  idbWorks = before === after && after === true
  console.log(idbWorks ? 'OK: IndexedDB persists across reload via file://' : `FAIL: IndexedDB did not persist (before=${before}, after=${after})`)
} catch (e) {
  console.log('FAIL: IndexedDB test threw an error via file://:', e.message)
}

console.log('CONSOLE_ERRORS:', errors.length)
errors.forEach((e) => console.log(e))

await browser.close()
