import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// RTL cleanup between tests so component instances don't leak across cases.
afterEach(() => {
  cleanup()
})