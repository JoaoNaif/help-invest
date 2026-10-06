import { describe, expect, it } from 'vitest'
import { makeUser } from 'test/factories/make-user'

describe('User', () => {
  it('should normalize the email on create', () => {
    const sut = makeUser({ email: '  John@Example.COM ' })

    expect(sut.email).toBe('john@example.com')
  })

  it('should normalize the email on update', () => {
    const sut = makeUser()

    sut.email = 'Jane@Example.com'

    expect(sut.email).toBe('jane@example.com')
  })

  it('should update updatedAt when changed', () => {
    const past = new Date('2026-01-01')
    const sut = makeUser({ updatedAt: past })

    sut.name = 'Jane'

    expect(sut.updatedAt.getTime()).toBeGreaterThan(past.getTime())
  })
})
