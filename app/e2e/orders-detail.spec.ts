import { test, expect } from '@playwright/test'

test.describe('Orders detail navigation', () => {
  test('clicking a list row opens the read-only order detail page', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 })

    // Rows are clickable and announce the order number (orders-table.tsx aria-label).
    await page.getByRole('row', { name: /View order 1001 details/ }).click()
    await page.waitForLoadState('networkidle')

    // The detail heading uses the client name (ID_Order is list-only, not shown on detail).
    await expect(page.getByRole('heading', { name: /Client Alpha/ })).toBeVisible({ timeout: 5000 })
    // Confirm the right order loaded via its sell price.
    await expect(page.getByText('€48,500.00')).toBeVisible()
  })

  test('an invalid order id shows the not-found state', async ({ page }) => {
    await page.goto('/orders/abc')
    await page.waitForLoadState('networkidle')

    // EmptyState renders the title as a <p>, not a heading.
    await expect(page.getByText('Order not found')).toBeVisible({ timeout: 5000 })
  })
})