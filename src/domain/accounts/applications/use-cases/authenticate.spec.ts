import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeEncrypter } from 'test/cryptography/fake-encrypter'
import { FakeHasher } from 'test/cryptography/fake-hasher'
import { FakeRefreshTokenGenerator } from 'test/cryptography/fake-refresh-token-generator'
import { makeUser } from 'test/factories/make-user'
import { InMemorySessionsRepository } from 'test/repositories/in-memory-sessions-repository'
import { InMemoryUsersRepository } from 'test/repositories/in-memory-users-repository'
import { WrongCredentialsError } from '../errors/wrong-credentials-error'
import { AuthenticateUseCase } from './authenticate'

let inMemoryUsersRepository: InMemoryUsersRepository
let inMemorySessionsRepository: InMemorySessionsRepository
let fakeHasher: FakeHasher
let fakeEncrypter: FakeEncrypter
let fakeRefreshTokenGenerator: FakeRefreshTokenGenerator
let sut: AuthenticateUseCase

describe('Authenticate', () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository()
    inMemorySessionsRepository = new InMemorySessionsRepository()
    fakeHasher = new FakeHasher()
    fakeEncrypter = new FakeEncrypter()
    fakeRefreshTokenGenerator = new FakeRefreshTokenGenerator()
    sut = new AuthenticateUseCase(
      inMemoryUsersRepository,
      inMemorySessionsRepository,
      fakeHasher,
      fakeEncrypter,
      fakeRefreshTokenGenerator
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function createUser() {
    const user = makeUser({
      email: 'john@example.com',
      passwordHash: await fakeHasher.hash('123456'),
    })
    await inMemoryUsersRepository.create(user)

    return user
  }

  it('should be able to authenticate', async () => {
    const user = await createUser()

    const result = await sut.execute({
      email: 'john@example.com',
      password: '123456',
    })

    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual({
      accessToken: JSON.stringify({ sub: user.id.toString() }),
      refreshToken: 'refresh-token-1',
    })
  })

  it('should create a session storing only the refresh token hash', async () => {
    const user = await createUser()

    await sut.execute({
      email: 'john@example.com',
      password: '123456',
      userAgent: 'Mozilla/5.0',
    })

    expect(inMemorySessionsRepository.items).toHaveLength(1)

    const session = inMemorySessionsRepository.items[0]
    expect(session.userId.equals(user.id)).toBe(true)
    expect(session.tokenHash).toBe('refresh-token-1-hashed')
    expect(session.userAgent).toBe('Mozilla/5.0')
    expect(session.isValid()).toBe(true)
  })

  it('should set the session to expire in 30 days', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
    await createUser()

    await sut.execute({ email: 'john@example.com', password: '123456' })

    expect(inMemorySessionsRepository.items[0].expiresAt).toEqual(
      new Date('2026-11-05T12:00:00Z')
    )
  })

  it('should authenticate regardless of email case and spaces', async () => {
    await createUser()

    const result = await sut.execute({
      email: '  John@Example.COM ',
      password: '123456',
    })

    expect(result.isRight()).toBe(true)
  })

  it('should not be able to authenticate with a wrong password', async () => {
    await createUser()

    const result = await sut.execute({
      email: 'john@example.com',
      password: 'wrong-password',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(WrongCredentialsError)
    expect(inMemorySessionsRepository.items).toHaveLength(0)
  })

  it('should not be able to authenticate with an unknown email', async () => {
    const result = await sut.execute({
      email: 'nobody@example.com',
      password: '123456',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(WrongCredentialsError)
    expect(inMemorySessionsRepository.items).toHaveLength(0)
  })
})
