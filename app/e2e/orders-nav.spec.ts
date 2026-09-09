import { test, expect } from '@playwright/test'

test.describe('Orders navigation', () => {
  test('sidebar links to Orders and the list renders', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Sidebar brand present
    await expect(page.getByRole('img', { name: 'Paperfold Stationery' })).toBeVisible()

    // Navigate to Orders via the sidebar
    await page.getByRole('link', { name: 'Orders' }).click()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
    // The mock repository always returns rows, so the table should appear.
    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 })
  })

  test('demo role switcher changes from user to admin', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'admin' }).click()

    await expect(page.getByText('Demo Admin · admin')).toBeVisible()
    await expect(page.getByRole('button', { name: 'New order' })).toBeVisible()
  })

  test('the Area dropdown narrows the order list', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: 'Area' }).click()
    await page.getByRole('checkbox', { name: 'BOPT' }).check()

    // BOPT orders include 1003 (Test Dealer) and 1004 (Demo Hospital).
    await expect(page.getByText('Test Dealer')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Client Beta')).toBeHidden()
  })
})
