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

  it('sanitizes SQL request, query, constraint, and conversion failures', () => {
    const expected = {
      code: 'unknown',
      message: 'Database operation failed. Check the required fields and the table constraints.',
    }

    expect(toConnectError({ code: 'EREQUEST', message: 'request failed: secret-value' })).toEqual(
      expect.objectContaining(expected),
    )
    expect(toConnectError({ code: 'EQUERY', message: 'query failed: secret-value' })).toEqual(
      expect.objectContaining(expected),
    )
    expect(toConnectError(new Error('The constraint was violated: secret-value'))).toEqual(
      expect.objectContaining(expected),
    )
    expect(toConnectError(new Error('Conversion failed for value secret-value'))).toEqual(
      expect.objectContaining(expected),
    )
  })
})
