import { describe, expect, it } from 'vitest'
import { toConnectError } from './errors.js'

describe('SQL Server error mapping', () => {
  it('maps driver error codes without returning raw driver messages', () => {
    expect(
      toConnectError({ code: 'ELOGIN', message: 'Driver rejected credentials' }),
    ).toMatchObject({
      code: 'login-failed',
      message: 'Login failed. Check the username and password.',
    })
    expect(toConnectError({ code: 'ETIMEOUT', message: 'Driver timeout' })).toMatchObject({
      code: 'timeout',
    })
    expect(toConnectError({ code: 'ESOCKET', message: 'Socket failure' })).toMatchObject({
      code: 'unreachable',
    })
  })

  it('never includes the raw password-bearing message', () => {
    const result = toConnectError(new Error('Login failed for password top-secret'))
    expect(result.message).not.toContain('top-secret')
  })
})
