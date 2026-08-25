import { test, expect } from '@playwright/test'

test.describe('Orders detail navigation', () => {
  test('clicking a list row opens the read-only order detail page', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 })

    // The Order # cell is a real link to the detail page (keyboard-accessible).
    await page.getByRole('link', { name: /View order 1001 details/ }).click()
    await page.waitForLoadState('networkidle')

    // The detail heading uses the client name (ID_Order is list-only, not shown on detail).
    await expect(page.getByRole('heading', { name: /Client Alpha/ })).toBeVisible({ timeout: 5000 })
    // Confirm the right order loaded via its sell price.
    await expect(page.getByText('€48,500.00')).toBeVisible()
  })

  test('an invalid order id shows the not-found state', async ({ page }) => {
    await page.goto('/orders/abc')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Order not found')).toBeVisible({ timeout: 5000 })
  })

  test('adds, edits, highlights, and deletes an invoicing document', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/orders/1004')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /Demo Hospital/ })).toBeVisible()

    await page.getByRole('tab', { name: 'Faturação' }).click()
    const panel = page.getByRole('tabpanel', { name: 'Faturação' })
    await panel.getByRole('button', { name: 'Adicionar documento' }).click()

    await panel.getByLabel('Tipo de documento').selectOption({ label: 'Nota Crédito' })
    await panel.getByLabel('Número do documento').fill('NC-E2E-001')
    await panel.getByLabel('Valor do documento').fill('39500')
    await panel.getByRole('button', { name: 'Adicionar', exact: true }).click()

    await expect(panel.getByText('Nota Crédito')).toBeVisible()
    await expect(panel.getByText('NC-E2E-001')).toBeVisible()
    await expect(panel.locator('[data-highlight="true"]')).toContainText('Net faturado')

    await panel.getByRole('button', { name: /Editar linha de documento/ }).click()
    await panel.getByLabel('Tipo de documento').selectOption({ label: 'Factura' })
    await panel.getByLabel('Número do documento').fill('FT-E2E-001')
    await panel.getByRole('button', { name: 'Guardar' }).click()

    await expect(panel.getByLabel('Tipo de documento')).toBeHidden()
    await expect(panel.getByRole('cell', { name: 'Factura', exact: true })).toBeVisible()
    await expect(panel.getByRole('cell', { name: 'FT-E2E-001', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('invoice-workflow.png'), fullPage: true })

    page.once('dialog', (dialog) => dialog.accept())
    await panel.getByRole('button', { name: /Apagar linha de documento/ }).click()
    await expect(panel.getByText('Sem documentos.')).toBeVisible()
  })

  test('propagates a maintenance contract into monthly CM rows', async ({ page }, testInfo) => {
    await page.goto('/orders/1007')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /Maintenance Co/ })).toBeVisible()

    await page.getByRole('button', { name: 'Propagar contrato' }).click()
    await page.getByLabel('Início do contrato').fill('2026-01-15')
    await page.getByLabel('Nº de anos do contrato').fill('1')
    await expect(page.getByText(/12 linhas.*total €12,000\.00/)).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Propagar', exact: true }).click()

    await expect(page.getByText('C Manut').first()).toBeVisible()
    await expect(page.getByText('1 Jan 2026')).toBeVisible()
    await expect(page.locator('[data-highlight="true"]')).toContainText('Total Reconhecido')
    await page.screenshot({
      path: testInfo.outputPath('maintenance-propagation.png'),
      fullPage: true,
    })
  })

  test('propagates warranty reserve as WP from the second warranty year', async ({ page }) => {
    await page.goto('/orders/1005')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /Client Alpha/ })).toBeVisible()

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('12 reconhecimentos de garantia (WP)')
      expect(dialog.message()).toContain('€37,500.00')
      await dialog.accept()
    })
    await page.getByRole('button', { name: 'Propagar garantia' }).click()

    await expect(page.getByText('Warranty Parcial').first()).toBeVisible()
    await expect(page.getByText('1 Jul 2026')).toBeVisible()
    await expect(page.getByText('€3,125.00').first()).toBeVisible()
  })
})
