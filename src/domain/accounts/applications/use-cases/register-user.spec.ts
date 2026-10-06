import { beforeEach, describe, expect, it } from 'vitest'
import { ResourceAlreadyExistsError } from '@/core/errors/err/resource-already-exists-error'
import { FakeHasher } from 'test/cryptography/fake-hasher'
import { makeUser } from 'test/factories/make-user'
import { InMemoryUsersRepository } from 'test/repositories/in-memory-users-repository'
import { RegisterUserUseCase } from './register-user'

let inMemoryUsersRepository: InMemoryUsersRepository
let fakeHasher: FakeHasher
let sut: RegisterUserUseCase

describe('Register User', () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository()
    fakeHasher = new FakeHasher()
    sut = new RegisterUserUseCase(inMemoryUsersRepository, fakeHasher)
  })

  it('should be able to register a new user', async () => {
    const result = await sut.execute({
      name: 'John Doe',
      email: 'john@example.com',
      password: '123456',
    })

    expect(result.isRight()).toBe(true)
    expect(inMemoryUsersRepository.items).toHaveLength(1)
    expect(result.value).toEqual({ user: inMemoryUsersRepository.items[0] })
  })

  it('should hash the user password upon registration', async () => {
    const result = await sut.execute({
      name: 'John Doe',
      email: 'john@example.com',
      password: '123456',
    })

    const hashedPassword = await fakeHasher.hash('123456')

    expect(result.isRight()).toBe(true)
    expect(inMemoryUsersRepository.items[0].passwordHash).toBe(hashedPassword)
  })

  it('should not be able to register with an email already in use', async () => {
    await inMemoryUsersRepository.create(
      makeUser({ email: 'john@example.com' })
    )

    const result = await sut.execute({
      name: 'John Doe',
      email: 'john@example.com',
      password: '123456',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError)
    expect(inMemoryUsersRepository.items).toHaveLength(1)
  })

  it('should treat emails with different case and spaces as the same', async () => {
    await inMemoryUsersRepository.create(
      makeUser({ email: 'john@example.com' })
    )

    const result = await sut.execute({
      name: 'John Doe',
      email: '  John@Example.COM ',
      password: '123456',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError)
  })
})
