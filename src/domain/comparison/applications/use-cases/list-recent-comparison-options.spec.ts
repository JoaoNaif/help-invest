import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { makeComparison } from 'test/factories/make-comparison'
import { makeComparisonOption } from 'test/factories/make-comparison-option'
import { InMemoryComparisonsRepository } from 'test/repositories/in-memory-comparisons-repository'
import {
  ListRecentComparisonOptionsUseCase,
  RECENT_OPTIONS_LIMIT,
} from './list-recent-comparison-options'

let comparisonsRepository: InMemoryComparisonsRepository
let sut: ListRecentComparisonOptionsUseCase

const userId = new UniqueEntityId()
const maturityAt = new Date('2028-10-06T00:00:00Z')

async function addOption(
  override: Parameters<typeof makeComparisonOption>[0],
  owner = userId
) {
  const comparison = makeComparison({ userId: owner })
  const option = makeComparisonOption({
    comparisonId: comparison.id,
    maturityAt,
    rate: new Decimal(110),
    ...override,
  })

  await comparisonsRepository.create(comparison, [option])

  return option
}

describe('List Recent Comparison Options', () => {
  beforeEach(() => {
    comparisonsRepository = new InMemoryComparisonsRepository()
    sut = new ListRecentComparisonOptionsUseCase(comparisonsRepository)
  })

  it('should list the options of the user, most recent first', async () => {
    await addOption({ issuerName: 'Antiga', createdAt: new Date('2026-01-01') })
    await addOption({ issuerName: 'Nova', createdAt: new Date('2026-10-01') })

    const result = await sut.execute({ userId: userId.toString() })

    expect(result.value.options.map((o) => o.issuerName)).toEqual([
      'Nova',
      'Antiga',
    ])
  })

  it('should not repeat the same option, keeping the most recent', async () => {
    await addOption({
      issuerName: 'Banco A',
      createdAt: new Date('2026-01-01'),
    })
    const recent = await addOption({
      issuerName: '  BANCO A ',
      createdAt: new Date('2026-10-01'),
    })

    const result = await sut.execute({ userId: userId.toString() })

    expect(result.value.options).toEqual([recent])
  })

  it('should keep options that differ in any key field', async () => {
    await addOption({ issuerName: 'Banco A', rate: new Decimal(110) })
    await addOption({ issuerName: 'Banco A', rate: new Decimal(112) })

    const result = await sut.execute({ userId: userId.toString() })

    expect(result.value.options).toHaveLength(2)
  })

  it('should never return options of other users', async () => {
    await addOption({ issuerName: 'De outro' }, new UniqueEntityId())

    const result = await sut.execute({ userId: userId.toString() })

    expect(result.value.options).toEqual([])
  })

  it('should cap the list', async () => {
    for (let index = 0; index < RECENT_OPTIONS_LIMIT + 5; index++) {
      await addOption({
        issuerName: `Banco ${index}`,
        createdAt: new Date(Date.UTC(2026, 0, index + 1)),
      })
    }

    const result = await sut.execute({ userId: userId.toString() })

    expect(result.value.options).toHaveLength(RECENT_OPTIONS_LIMIT)
  })
})
