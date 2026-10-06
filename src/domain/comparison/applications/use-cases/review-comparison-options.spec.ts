import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { DataSource } from '@/domain/shared/enums/data-source'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import { makeComparison } from 'test/factories/make-comparison'
import { makeComparisonOption } from 'test/factories/make-comparison-option'
import { InMemoryComparisonsRepository } from 'test/repositories/in-memory-comparisons-repository'
import { Comparison } from '../../entities/comparison'
import { ComparisonOption } from '../../entities/comparison-option'
import { ComparisonStatus } from '../../entities/enums/comparison-status'
import { InvalidComparisonStatusError } from '../errors/invalid-comparison-status-error'
import { NoOptionsFoundError } from '../errors/no-options-found-error'
import {
  ReviewComparisonOptionsUseCase,
  ReviewedOptionInput,
} from './review-comparison-options'

let inMemoryComparisonsRepository: InMemoryComparisonsRepository
let sut: ReviewComparisonOptionsUseCase

let comparison: Comparison
let extractedA: ComparisonOption
let extractedB: ComparisonOption

function inputFrom(option: ComparisonOption): ReviewedOptionInput {
  return {
    id: option.id.toString(),
    assetType: option.assetType,
    indexer: option.indexer,
    rate: option.rate,
    issuerName: option.issuerName,
    issuerCnpj: option.issuerCnpj,
    maturityAt: option.maturityAt,
    liquidity: option.liquidity,
    graceDays: option.graceDays,
    minAmount: option.minAmount,
  }
}

describe('Review Comparison Options', () => {
  const userId = new UniqueEntityId()

  beforeEach(async () => {
    inMemoryComparisonsRepository = new InMemoryComparisonsRepository()
    sut = new ReviewComparisonOptionsUseCase(inMemoryComparisonsRepository)

    comparison = makeComparison({ userId })
    extractedA = makeComparisonOption({
      comparisonId: comparison.id,
      source: DataSource.LLM_EXTRACTED,
      rate: new Decimal('11'),
      rawInput: 'CDB Banco A 110% CDI',
    })
    extractedB = makeComparisonOption({
      comparisonId: comparison.id,
      source: DataSource.LLM_EXTRACTED,
    })
    await inMemoryComparisonsRepository.create(comparison, [
      extractedA,
      extractedB,
    ])
  })

  function execute(options: ReviewedOptionInput[], asUser = userId) {
    return sut.execute({
      userId: asUser.toString(),
      comparisonId: comparison.id.toString(),
      options,
    })
  }

  it('should correct an option extracted wrong by the LLM', async () => {
    const result = await execute([
      { ...inputFrom(extractedA), rate: new Decimal('110') },
      inputFrom(extractedB),
    ])

    expect(result.isRight()).toBe(true)
    expect(extractedA.rate.equals('110')).toBe(true)
  })

  it('should keep the original source and raw input of edited options', async () => {
    await execute([
      { ...inputFrom(extractedA), rate: new Decimal('110') },
      inputFrom(extractedB),
    ])

    expect(extractedA.source).toBe(DataSource.LLM_EXTRACTED)
    expect(extractedA.rawInput).toBe('CDB Banco A 110% CDI')
  })

  it('should clear optional fields that were not sent', async () => {
    extractedA.graceDays = 30
    const withoutGrace = inputFrom(extractedA)
    delete withoutGrace.graceDays

    await execute([withoutGrace, inputFrom(extractedB)])

    expect(extractedA.graceDays).toBeNull()
  })

  it('should add a new option as manual', async () => {
    const result = await execute([
      inputFrom(extractedA),
      inputFrom(extractedB),
      {
        assetType: AssetType.LCA,
        indexer: Indexer.CDI,
        rate: new Decimal('95'),
        liquidity: Liquidity.AT_MATURITY,
      },
    ])

    expect(result.isRight()).toBe(true)

    const options =
      await inMemoryComparisonsRepository.findOptionsByComparisonId(
        comparison.id.toString()
      )
    expect(options).toHaveLength(3)
    expect(options[2].source).toBe(DataSource.MANUAL)
    expect(options[2].comparisonId.equals(comparison.id)).toBe(true)
  })

  it('should remove options left out of the list', async () => {
    await execute([inputFrom(extractedA)])

    const options =
      await inMemoryComparisonsRepository.findOptionsByComparisonId(
        comparison.id.toString()
      )
    expect(options).toEqual([extractedA])
  })

  it('should not touch options of other comparisons', async () => {
    const other = makeComparison({ userId })
    const otherOption = makeComparisonOption({ comparisonId: other.id })
    await inMemoryComparisonsRepository.create(other, [otherOption])

    await execute([inputFrom(extractedA)])

    expect(inMemoryComparisonsRepository.options).toContain(otherOption)
  })

  it('should not accept an option id from another comparison', async () => {
    const other = makeComparison({ userId })
    const otherOption = makeComparisonOption({ comparisonId: other.id })
    await inMemoryComparisonsRepository.create(other, [otherOption])

    const result = await execute([inputFrom(otherOption)])

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
    expect(otherOption.comparisonId.equals(other.id)).toBe(true)
  })

  it('should not accept an empty list', async () => {
    const result = await execute([])

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(NoOptionsFoundError)
  })

  it('should only allow reviewing a draft', async () => {
    comparison.confirm()

    const result = await execute([inputFrom(extractedA)])

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InvalidComparisonStatusError)
    expect(comparison.status).toBe(ComparisonStatus.CONFIRMED)
  })

  it('should not allow reviewing a comparison from another user', async () => {
    const result = await execute([inputFrom(extractedA)], new UniqueEntityId())

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(NotAllowedError)
  })

  it('should return not found for an unknown comparison', async () => {
    const result = await sut.execute({
      userId: userId.toString(),
      comparisonId: 'unknown-id',
      options: [inputFrom(extractedA)],
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
  })
})
