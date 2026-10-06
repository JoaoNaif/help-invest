import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { makeComparison } from 'test/factories/make-comparison'
import { InMemoryComparisonsRepository } from 'test/repositories/in-memory-comparisons-repository'
import {
  COMPARISONS_PER_PAGE,
  ListComparisonsUseCase,
} from './list-comparisons'

let comparisonsRepository: InMemoryComparisonsRepository
let sut: ListComparisonsUseCase

const userId = new UniqueEntityId()

describe('List Comparisons', () => {
  beforeEach(() => {
    comparisonsRepository = new InMemoryComparisonsRepository()
    sut = new ListComparisonsUseCase(comparisonsRepository)
  })

  it('should list only the comparisons of the user, most recent first', async () => {
    const old = makeComparison({ userId, createdAt: new Date('2026-01-01') })
    const recent = makeComparison({ userId, createdAt: new Date('2026-10-01') })
    const middle = makeComparison({ userId, createdAt: new Date('2026-05-01') })
    await comparisonsRepository.create(old, [])
    await comparisonsRepository.create(recent, [])
    await comparisonsRepository.create(middle, [])
    await comparisonsRepository.create(makeComparison(), [])

    const result = await sut.execute({ userId: userId.toString() })

    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual({ comparisons: [recent, middle, old] })
  })

  it('should paginate the history', async () => {
    for (let index = 0; index < COMPARISONS_PER_PAGE + 2; index++) {
      await comparisonsRepository.create(
        makeComparison({
          userId,
          createdAt: new Date(Date.UTC(2026, 0, index + 1)),
        }),
        []
      )
    }

    const page1 = await sut.execute({ userId: userId.toString(), page: 1 })
    const page2 = await sut.execute({ userId: userId.toString(), page: 2 })

    expect(page1.value.comparisons).toHaveLength(COMPARISONS_PER_PAGE)
    expect(page2.value.comparisons).toHaveLength(2)
    // Página 2 tem as mais antigas.
    expect(page2.value.comparisons[1].createdAt).toEqual(
      new Date(Date.UTC(2026, 0, 1))
    )
  })

  it('should return an empty list when there is no history', async () => {
    const result = await sut.execute({ userId: userId.toString() })

    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual({ comparisons: [] })
  })
})
