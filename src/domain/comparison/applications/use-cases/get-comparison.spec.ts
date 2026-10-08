import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { makeComparison } from 'test/factories/make-comparison'
import { makeComparisonOption } from 'test/factories/make-comparison-option'
import { makeLlmLog } from 'test/factories/make-llm-log'
import { InMemoryComparisonsRepository } from 'test/repositories/in-memory-comparisons-repository'
import { InMemoryLlmLogsRepository } from 'test/repositories/in-memory-llm-logs-repository'
import { Comparison } from '../../entities/comparison'
import { makeExplanation } from 'test/factories/make-explanation'
import { ComparisonExplanation } from '../dtos/comparison-explanation'
import { toExplanationLogResponse } from '../mappers/explanation-log-response'
import { GetComparisonUseCase } from './get-comparison'

let comparisonsRepository: InMemoryComparisonsRepository
let llmLogsRepository: InMemoryLlmLogsRepository
let sut: GetComparisonUseCase

const userId = new UniqueEntityId()

async function createComparison({ evaluated = true } = {}) {
  const comparison = makeComparison({ userId })
  const low = makeComparisonOption({ comparisonId: comparison.id })
  const high = makeComparisonOption({ comparisonId: comparison.id })

  if (evaluated) {
    low.applyEvaluation(new Decimal('12.5'), [])
    high.applyEvaluation(new Decimal('14.08'), [])
    comparison.confirm()
    comparison.complete({})
  }

  await comparisonsRepository.create(comparison, [low, high])

  return { comparison, low, high }
}

async function logExplanation(
  comparison: Comparison,
  explanation: ComparisonExplanation | null,
  createdAt: Date
) {
  await llmLogsRepository.create(
    makeLlmLog({
      userId,
      purpose: LlmPurpose.EXPLANATION,
      comparisonId: comparison.id,
      response: toExplanationLogResponse(explanation, { raw: true }),
      createdAt,
    })
  )
}

function execute(comparison: Comparison, asUser = userId) {
  return sut.execute({
    userId: asUser.toString(),
    comparisonId: comparison.id.toString(),
  })
}

describe('Get Comparison', () => {
  beforeEach(() => {
    comparisonsRepository = new InMemoryComparisonsRepository()
    llmLogsRepository = new InMemoryLlmLogsRepository()
    sut = new GetComparisonUseCase(comparisonsRepository, llmLogsRepository)
  })

  it('should return the comparison with its options ranked', async () => {
    const { comparison, low, high } = await createComparison()

    const result = await execute(comparison)

    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual({
      comparison,
      options: [high, low],
      explanation: null,
    })
  })

  it('should keep the original order for a draft', async () => {
    const { comparison, low, high } = await createComparison({
      evaluated: false,
    })

    const result = await execute(comparison)

    expect(result.isRight() && result.value.options).toEqual([low, high])
  })

  it('should return the latest explanation', async () => {
    const { comparison } = await createComparison()
    await logExplanation(
      comparison,
      makeExplanation({ summary: 'Antiga' }),
      new Date('2026-10-01')
    )
    await logExplanation(
      comparison,
      makeExplanation({ summary: 'Mais nova' }),
      new Date('2026-10-05')
    )

    const result = await execute(comparison)

    expect(result.isRight() && result.value.explanation?.summary).toBe(
      'Mais nova'
    )
  })

  it('should skip failed explanation attempts', async () => {
    const { comparison } = await createComparison()
    await logExplanation(
      comparison,
      makeExplanation({ summary: 'Válida' }),
      new Date('2026-10-01')
    )
    await logExplanation(comparison, null, new Date('2026-10-05'))

    const result = await execute(comparison)

    expect(result.isRight() && result.value.explanation?.summary).toBe(
      'Válida'
    )
  })

  it('should ignore extraction logs and other comparisons', async () => {
    const { comparison } = await createComparison()
    const other = await createComparison()
    await logExplanation(
      other.comparison,
      makeExplanation({ summary: 'De outra' }),
      new Date('2026-10-05')
    )
    await llmLogsRepository.create(
      makeLlmLog({
        purpose: LlmPurpose.EXTRACTION,
        comparisonId: comparison.id,
        response: { explanation: 'Não é explicação' },
      })
    )

    const result = await execute(comparison)

    expect(result.isRight() && result.value.explanation).toBeNull()
  })

  it('should not return a comparison from another user', async () => {
    const { comparison } = await createComparison()

    const result = await execute(comparison, new UniqueEntityId())

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(NotAllowedError)
  })

  it('should return not found for an unknown comparison', async () => {
    const result = await sut.execute({
      userId: userId.toString(),
      comparisonId: 'unknown-id',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
  })
})
