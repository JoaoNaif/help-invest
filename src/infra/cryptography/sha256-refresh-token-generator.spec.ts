import { beforeEach, describe, expect, it } from 'vitest'
import { Sha256RefreshTokenGenerator } from './sha256-refresh-token-generator'

let sut: Sha256RefreshTokenGenerator

describe('Sha256 Refresh Token Generator', () => {
  beforeEach(() => {
    sut = new Sha256RefreshTokenGenerator()
  })

  it('should be able to generate unique url-safe tokens', () => {
    const first = sut.generate()
    const second = sut.generate()

    expect(first).not.toEqual(second)
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('should be able to hash a token deterministically', () => {
    const token = sut.generate()

    expect(sut.hash(token)).toEqual(sut.hash(token))
    expect(sut.hash(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(sut.hash(token)).not.toEqual(token)
  })
})
