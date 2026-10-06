import { describe, expect, it } from 'vitest'
import { makeSession } from 'test/factories/make-session'

describe('Session', () => {
  const now = new Date('2026-10-06T12:00:00Z')

  it('should be valid when not expired and not revoked', () => {
    const sut = makeSession({ expiresAt: new Date('2026-11-01') })

    expect(sut.isValid(now)).toBe(true)
  })

  it('should not be valid when expired', () => {
    const sut = makeSession({ expiresAt: new Date('2026-10-01') })

    expect(sut.isExpired(now)).toBe(true)
    expect(sut.isValid(now)).toBe(false)
  })

  it('should not be valid after being revoked', () => {
    const sut = makeSession({ expiresAt: new Date('2026-11-01') })

    sut.revoke(now)

    expect(sut.isRevoked).toBe(true)
    expect(sut.revokedAt).toEqual(now)
    expect(sut.isValid(now)).toBe(false)
  })

  it('should keep the first revocation date when revoked twice', () => {
    const sut = makeSession()

    sut.revoke(now)
    sut.revoke(new Date('2026-12-01'))

    expect(sut.revokedAt).toEqual(now)
  })
})
