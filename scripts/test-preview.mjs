import { chromium } from 'playwright'

const BASE = 'http://localhost:4173'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Dashboard', { timeout: 10000 })
console.log('OK dist/ served: dashboard renders')

await page.click('text=Domaines')
await page.waitForSelector('text=Secure identity and access', { timeout: 10000 })
console.log('OK dist/ served: navigation works')

console.log('ERRORS:', errors.length)
errors.forEach((e) => console.log(e))

await browser.close()
process.exit(errors.length ? 1 : 0)
