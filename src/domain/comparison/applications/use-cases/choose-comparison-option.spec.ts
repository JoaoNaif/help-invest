import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { makeComparison } from 'test/factories/make-comparison'
import { makeComparisonOption } from 'test/factories/make-comparison-option'
import { InMemoryComparisonsRepository } from 'test/repositories/in-memory-comparisons-repository'
import { Comparison } from '../../entities/comparison'
import { ComparisonOption } from '../../entities/comparison-option'
import { InvalidComparisonStatusError } from '../errors/invalid-comparison-status-error'
import { ChooseComparisonOptionUseCase } from './choose-comparison-option'

let comparisonsRepository: InMemoryComparisonsRepository
let sut: ChooseComparisonOptionUseCase

const userId = new UniqueEntityId()

async function createComparison({ evaluated = true } = {}) {
  const comparison = makeComparison({ userId })
  const options = [
    makeComparisonOption({ comparisonId: comparison.id }),
    makeComparisonOption({ comparisonId: comparison.id }),
  ]

  if (evaluated) {
    options.forEach((option) => option.applyEvaluation(new Decimal('13.5'), []))
    comparison.confirm()
    comparison.complete({})
  }

  await comparisonsRepository.create(comparison, options)

  return { comparison, options }
}

function execute(
  comparison: Comparison,
  option: ComparisonOption | string,
  asUser = userId
) {
  return sut.execute({
    userId: asUser.toString(),
    comparisonId: comparison.id.toString(),
    optionId: typeof option === 'string' ? option : option.id.toString(),
  })
}

describe('Choose Comparison Option', () => {
  beforeEach(() => {
    comparisonsRepository = new InMemoryComparisonsRepository()
    sut = new ChooseComparisonOptionUseCase(comparisonsRepository)
  })

  it('should register the option chosen by the user', async () => {
    const { comparison, options } = await createComparison()

    const result = await execute(comparison, options[1])

    expect(result.isRight()).toBe(true)
    expect(comparison.chosenOptionId?.equals(options[1].id)).toBe(true)
    expect(
      comparisonsRepository.items[0].chosenOptionId?.equals(options[1].id)
    ).toBe(true)
  })

  it('should allow changing the choice', async () => {
    const { comparison, options } = await createComparison()

    await execute(comparison, options[0])
    await execute(comparison, options[1])

    expect(comparison.chosenOptionId?.equals(options[1].id)).toBe(true)
  })

  it('should keep the options and their results untouched', async () => {
    const { comparison, options } = await createComparison()

    await execute(comparison, options[0])

    const stored = await comparisonsRepository.findOptionsByComparisonId(
      comparison.id.toString()
    )
    expect(stored).toEqual(options)
    expect(stored.every((option) => option.isEvaluated)).toBe(true)
  })

  it('should not accept an option from another comparison', async () => {
    const { comparison } = await createComparison()
    const other = await createComparison()

    const result = await execute(comparison, other.options[0])

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
    expect(comparison.chosenOptionId).toBeNull()
  })

  it('should only allow choosing after the evaluation', async () => {
    const { comparison, options } = await createComparison({
      evaluated: false,
    })

    const result = await execute(comparison, options[0])

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InvalidComparisonStatusError)
    expect(comparison.chosenOptionId).toBeNull()
  })

  it('should not allow choosing in a comparison from another user', async () => {
    const { comparison, options } = await createComparison()

    const result = await execute(comparison, options[0], new UniqueEntityId())

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(NotAllowedError)
    expect(comparison.chosenOptionId).toBeNull()
  })

  it('should return not found for an unknown comparison', async () => {
    const result = await sut.execute({
      userId: userId.toString(),
      comparisonId: 'unknown-id',
      optionId: 'any',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
  })
})
