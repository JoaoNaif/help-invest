import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'
import { InMemoryInvestorProfilesRepository } from 'test/repositories/in-memory-investor-profiles-repository'
import { GetInvestorProfileUseCase } from './get-investor-profile'

let inMemoryInvestorProfilesRepository: InMemoryInvestorProfilesRepository
let sut: GetInvestorProfileUseCase

describe('Get Investor Profile', () => {
  const userId = new UniqueEntityId()

  beforeEach(() => {
    inMemoryInvestorProfilesRepository =
      new InMemoryInvestorProfilesRepository()
    sut = new GetInvestorProfileUseCase(inMemoryInvestorProfilesRepository)

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should be able to get the profile of the user', async () => {
    const profile = makeInvestorProfile({ userId })
    await inMemoryInvestorProfilesRepository.create(makeInvestorProfile())
    await inMemoryInvestorProfilesRepository.create(profile)

    const result = await sut.execute({ userId: userId.toString() })

    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual({ profile, isOutdated: false })
  })

  it('should flag the profile as outdated after 6 months', async () => {
    await inMemoryInvestorProfilesRepository.create(
      makeInvestorProfile({
        userId,
        updatedAt: new Date('2026-03-01T00:00:00Z'),
      })
    )

    const result = await sut.execute({ userId: userId.toString() })

    expect(result.isRight()).toBe(true)
    expect(result.isRight() && result.value.isOutdated).toBe(true)
  })

  it('should return not found when the profile was not filled yet', async () => {
    const result = await sut.execute({ userId: userId.toString() })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
  })
})
