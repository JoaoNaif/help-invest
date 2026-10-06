import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { FakeEncrypter } from 'test/cryptography/fake-encrypter'
import { FakeRefreshTokenGenerator } from 'test/cryptography/fake-refresh-token-generator'
import { makeSession } from 'test/factories/make-session'
import { InMemorySessionsRepository } from 'test/repositories/in-memory-sessions-repository'
import { InvalidSessionError } from '../errors/invalid-session-error'
import { RefreshSessionUseCase } from './refresh-session'

let inMemorySessionsRepository: InMemorySessionsRepository
let fakeEncrypter: FakeEncrypter
let fakeRefreshTokenGenerator: FakeRefreshTokenGenerator
let sut: RefreshSessionUseCase

describe('Refresh Session', () => {
  const userId = new UniqueEntityId()

  beforeEach(() => {
    inMemorySessionsRepository = new InMemorySessionsRepository()
    fakeEncrypter = new FakeEncrypter()
    fakeRefreshTokenGenerator = new FakeRefreshTokenGenerator()
    sut = new RefreshSessionUseCase(
      inMemorySessionsRepository,
      fakeEncrypter,
      fakeRefreshTokenGenerator
    )

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function createSession(override: Parameters<typeof makeSession>[0]) {
    const session = makeSession({
      userId,
      tokenHash: fakeRefreshTokenGenerator.hash('current-token'),
      expiresAt: new Date('2026-11-01T00:00:00Z'),
      ...override,
    })
    await inMemorySessionsRepository.create(session)

    return session
  }

  it('should be able to refresh a valid session', async () => {
    await createSession({})

    const result = await sut.execute({ refreshToken: 'current-token' })

    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual({
      accessToken: JSON.stringify({ sub: userId.toString() }),
      refreshToken: 'refresh-token-1',
    })
  })

  it('should rotate: revoke the old session and create a new one', async () => {
    const oldSession = await createSession({ userAgent: 'Mozilla/5.0' })

    await sut.execute({ refreshToken: 'current-token' })

    expect(inMemorySessionsRepository.items).toHaveLength(2)
    expect(oldSession.isRevoked).toBe(true)

    const newSession = inMemorySessionsRepository.items[1]
    expect(newSession.userId.equals(userId)).toBe(true)
    expect(newSession.tokenHash).toBe('refresh-token-1-hashed')
    expect(newSession.userAgent).toBe('Mozilla/5.0')
    expect(newSession.expiresAt).toEqual(new Date('2026-11-05T12:00:00Z'))
    expect(newSession.isValid()).toBe(true)
  })

  it('should not accept the same refresh token twice', async () => {
    await createSession({})

    await sut.execute({ refreshToken: 'current-token' })
    const result = await sut.execute({ refreshToken: 'current-token' })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InvalidSessionError)
  })

  it('should revoke all user sessions when a revoked token is reused', async () => {
    await createSession({ revokedAt: new Date('2026-10-05T00:00:00Z') })
    const otherSession = makeSession({
      userId,
      expiresAt: new Date('2026-11-01T00:00:00Z'),
    })
    const otherUserSession = makeSession({
      expiresAt: new Date('2026-11-01T00:00:00Z'),
    })
    await inMemorySessionsRepository.create(otherSession)
    await inMemorySessionsRepository.create(otherUserSession)

    const result = await sut.execute({ refreshToken: 'current-token' })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InvalidSessionError)
    expect(otherSession.isRevoked).toBe(true)
    expect(otherUserSession.isRevoked).toBe(false)
  })

  it('should not be able to refresh an expired session', async () => {
    await createSession({ expiresAt: new Date('2026-10-01T00:00:00Z') })

    const result = await sut.execute({ refreshToken: 'current-token' })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InvalidSessionError)
    expect(inMemorySessionsRepository.items).toHaveLength(1)
  })

  it('should not be able to refresh with an unknown token', async () => {
    const result = await sut.execute({ refreshToken: 'unknown-token' })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InvalidSessionError)
  })
})
