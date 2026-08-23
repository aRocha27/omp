import { test, expect } from '@playwright/test'

test.describe('Orders detail navigation', () => {
  test('clicking a list row opens the read-only order detail page', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 })

    // Rows are clickable and announce the order id (orders-table.tsx aria-label).
    await page.getByRole('row', { name: /View order 1001 details/ }).click()
    await page.waitForLoadState('networkidle')

    // Detail page renders the order heading and the resolved client name.
    await expect(page.getByRole('heading', { name: /Order #1001/ })).toBeVisible({ timeout: 5000 })
    // Exact match — "Client Alpha" also appears in the Obs notes text.
    await expect(page.getByText('Client Alpha', { exact: true })).toBeVisible()
  })

  test('an invalid order id shows the not-found state', async ({ page }) => {
    await page.goto('/orders/abc')
    await page.waitForLoadState('networkidle')

    // EmptyState renders the title as a <p>, not a heading.
    await expect(page.getByText('Order not found')).toBeVisible({ timeout: 5000 })
  })
})