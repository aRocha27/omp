import { test, expect } from '@playwright/test'

test.describe('Orders navigation', () => {
  test('sidebar links to Orders and the list renders', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Sidebar brand present
    await expect(page.getByText('Orders Platform')).toBeVisible()

    // Navigate to Orders via the sidebar
    await page.getByRole('link', { name: 'Orders' }).click()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
    // The mock repository always returns rows, so the table should appear.
    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 })
  })

  test('viewers do not see the New order button', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForLoadState('networkidle')

    // Switch to the Viewer role
    await page.getByRole('button', { name: 'viewer' }).click()
    await expect(page.getByRole('table')).toBeVisible()

    // UX gating only — server still enforces (SECURITY.md §2-3)
    await expect(page.getByRole('button', { name: 'New order' })).toBeHidden()
  })

  test('the Area dropdown narrows the order list', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 })

    // Area is the only filter select offering "Systems" (option value '2').
    await page.getByRole('combobox').filter({ hasText: 'Systems' }).selectOption('2')

    // Area 2 orders are 1003 (Test Dealer) and 1004 (Demo Hospital).
    await expect(page.getByText('Test Dealer')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Client Beta')).toBeHidden()
  })
})