import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { FakeRefreshTokenGenerator } from 'test/cryptography/fake-refresh-token-generator'
import { makeSession } from 'test/factories/make-session'
import { InMemorySessionsRepository } from 'test/repositories/in-memory-sessions-repository'
import { LogoutUseCase } from './logout'

let inMemorySessionsRepository: InMemorySessionsRepository
let fakeRefreshTokenGenerator: FakeRefreshTokenGenerator
let sut: LogoutUseCase

describe('Logout', () => {
  beforeEach(() => {
    inMemorySessionsRepository = new InMemorySessionsRepository()
    fakeRefreshTokenGenerator = new FakeRefreshTokenGenerator()
    sut = new LogoutUseCase(
      inMemorySessionsRepository,
      fakeRefreshTokenGenerator
    )
  })

  it('should be able to revoke the session', async () => {
    const session = makeSession({
      tokenHash: fakeRefreshTokenGenerator.hash('current-token'),
    })
    await inMemorySessionsRepository.create(session)

    const result = await sut.execute({ refreshToken: 'current-token' })

    expect(result.isRight()).toBe(true)
    expect(session.isRevoked).toBe(true)
  })

  it('should only revoke the session of the given token', async () => {
    const userId = new UniqueEntityId()
    const session = makeSession({
      userId,
      tokenHash: fakeRefreshTokenGenerator.hash('current-token'),
    })
    const otherDeviceSession = makeSession({ userId })
    await inMemorySessionsRepository.create(session)
    await inMemorySessionsRepository.create(otherDeviceSession)

    await sut.execute({ refreshToken: 'current-token' })

    expect(otherDeviceSession.isRevoked).toBe(false)
  })

  it('should keep the original revocation date when already revoked', async () => {
    const revokedAt = new Date('2026-10-01T00:00:00Z')
    const session = makeSession({
      tokenHash: fakeRefreshTokenGenerator.hash('current-token'),
      revokedAt,
    })
    await inMemorySessionsRepository.create(session)

    const result = await sut.execute({ refreshToken: 'current-token' })

    expect(result.isRight()).toBe(true)
    expect(session.revokedAt).toEqual(revokedAt)
  })

  it('should succeed even when the token is unknown', async () => {
    const result = await sut.execute({ refreshToken: 'unknown-token' })

    expect(result.isRight()).toBe(true)
  })
})
