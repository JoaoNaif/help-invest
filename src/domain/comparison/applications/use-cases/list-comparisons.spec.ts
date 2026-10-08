import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { makeComparison } from 'test/factories/make-comparison'
import { makeComparisonOption } from 'test/factories/make-comparison-option'
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
    expect(result.value.comparisons.map((item) => item.comparison)).toEqual([
      recent,
      middle,
      old,
    ])
  })

  it('should summarize the options: count and the best net rate', async () => {
    const evaluated = makeComparison({ userId })
    const low = makeComparisonOption({ comparisonId: evaluated.id })
    const high = makeComparisonOption({ comparisonId: evaluated.id })
    low.applyEvaluation(new Decimal('11.5'), [])
    high.applyEvaluation(new Decimal('13.2'), [])
    await comparisonsRepository.create(evaluated, [low, high])

    const draft = makeComparison({ userId })
    await comparisonsRepository.create(draft, [
      makeComparisonOption({ comparisonId: draft.id }),
    ])

    const result = await sut.execute({ userId: userId.toString() })
    const byId = new Map(
      result.value.comparisons.map((item) => [
        item.comparison.id.toString(),
        item,
      ])
    )

    expect(byId.get(evaluated.id.toString())).toEqual(
      expect.objectContaining({ optionsCount: 2, topOption: high })
    )
    // Sem avaliação não há "melhor": só a contagem.
    expect(byId.get(draft.id.toString())).toEqual(
      expect.objectContaining({ optionsCount: 1, topOption: null })
    )
  })

  it('should only count the options of each comparison', async () => {
    const first = makeComparison({ userId })
    const second = makeComparison({ userId })
    await comparisonsRepository.create(first, [
      makeComparisonOption({ comparisonId: first.id }),
    ])
    await comparisonsRepository.create(second, [])

    const result = await sut.execute({ userId: userId.toString() })

    expect(
      result.value.comparisons.map((item) => item.optionsCount).sort()
    ).toEqual([0, 1])
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
    expect(page2.value.comparisons[1].comparison.createdAt).toEqual(
      new Date(Date.UTC(2026, 0, 1))
    )
  })

  it('should return an empty list when there is no history', async () => {
    const result = await sut.execute({ userId: userId.toString() })

    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual({ comparisons: [] })
  })
})
