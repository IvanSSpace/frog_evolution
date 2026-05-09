import { test, expect } from '@playwright/test'

test('app loads without JS errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')
  // Wait for Phaser canvas or main UI element
  await page.waitForSelector('canvas, #root > *', { timeout: 15_000 })

  expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0)
})

test('canvas is rendered', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible({ timeout: 15_000 })
})

test('no network failures on critical assets', async ({ page }) => {
  const failed: string[] = []
  page.on('response', (res) => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`)
  })

  await page.goto('/')
  await page.waitForSelector('canvas, #root > *', { timeout: 15_000 })
  // Filter out non-critical 404s (analytics, etc.)
  const critical = failed.filter((f) => !f.includes('favicon'))
  expect(critical).toHaveLength(0)
})
