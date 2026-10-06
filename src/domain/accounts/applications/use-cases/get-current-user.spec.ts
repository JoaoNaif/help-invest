import { beforeEach, describe, expect, it } from 'vitest'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { makeUser } from 'test/factories/make-user'
import { InMemoryUsersRepository } from 'test/repositories/in-memory-users-repository'
import { GetCurrentUserUseCase } from './get-current-user'

let inMemoryUsersRepository: InMemoryUsersRepository
let sut: GetCurrentUserUseCase

describe('Get Current User', () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository()
    sut = new GetCurrentUserUseCase(inMemoryUsersRepository)
  })

  it('should be able to get the current user', async () => {
    const user = makeUser()
    await inMemoryUsersRepository.create(makeUser())
    await inMemoryUsersRepository.create(user)

    const result = await sut.execute({ userId: user.id.toString() })

    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual({ user })
  })

  it('should return not found when the user no longer exists', async () => {
    const result = await sut.execute({ userId: 'deleted-user-id' })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
  })
})
