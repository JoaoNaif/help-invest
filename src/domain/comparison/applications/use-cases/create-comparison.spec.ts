import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { DataSource } from '@/domain/shared/enums/data-source'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import { FakeLlmGateway } from 'test/gateways/fake-llm-gateway'
import { InMemoryComparisonsRepository } from 'test/repositories/in-memory-comparisons-repository'
import { InMemoryLlmLogsRepository } from 'test/repositories/in-memory-llm-logs-repository'
import { ComparisonStatus } from '../../entities/enums/comparison-status'
import { ComparisonOptionInput } from '../dtos/comparison-option-input'
import { ExtractionFailedError } from '../errors/extraction-failed-error'
import { LlmUnavailableError } from '../errors/llm-unavailable-error'
import { NoOptionsFoundError } from '../errors/no-options-found-error'
import { CreateComparisonUseCase } from './create-comparison'

let inMemoryComparisonsRepository: InMemoryComparisonsRepository
let inMemoryLlmLogsRepository: InMemoryLlmLogsRepository
let fakeLlmGateway: FakeLlmGateway
let sut: CreateComparisonUseCase

const cdbA: ComparisonOptionInput = {
  assetType: AssetType.CDB,
  indexer: Indexer.CDI,
  rate: new Decimal('110'),
  issuerName: 'Banco A',
  issuerCnpj: '11111111000111',
  maturityAt: new Date('2028-10-06T00:00:00Z'),
  liquidity: Liquidity.AT_MATURITY,
}

const lciB: ComparisonOptionInput = {
  assetType: AssetType.LCI,
  indexer: Indexer.CDI,
  rate: new Decimal('92'),
  issuerName: 'Banco B',
  liquidity: Liquidity.GRACE_PERIOD,
  graceDays: 90,
  rawInput: 'LCI Banco B 92% CDI carência 90 dias',
}

describe('Create Comparison', () => {
  const userId = new UniqueEntityId()
  const base = {
    userId: userId.toString(),
    amount: new Decimal('50000'),
    horizonMonths: 24,
  }

  beforeEach(() => {
    inMemoryComparisonsRepository = new InMemoryComparisonsRepository()
    inMemoryLlmLogsRepository = new InMemoryLlmLogsRepository()
    fakeLlmGateway = new FakeLlmGateway()
    sut = new CreateComparisonUseCase(
      inMemoryComparisonsRepository,
      fakeLlmGateway,
      inMemoryLlmLogsRepository
    )
  })

  describe('manual input', () => {
    it('should create a draft comparison with the given options', async () => {
      const result = await sut.execute({
        ...base,
        input: { type: 'manual', options: [cdbA, lciB] },
      })

      expect(result.isRight()).toBe(true)

      const [comparison] = inMemoryComparisonsRepository.items
      expect(comparison.userId.equals(userId)).toBe(true)
      expect(comparison.amount.equals('50000')).toBe(true)
      expect(comparison.horizonMonths).toBe(24)
      expect(comparison.status).toBe(ComparisonStatus.DRAFT)

      const options = inMemoryComparisonsRepository.options
      expect(options).toHaveLength(2)
      expect(options.every((o) => o.comparisonId.equals(comparison.id))).toBe(
        true
      )
      expect(options.every((o) => o.source === DataSource.MANUAL)).toBe(true)
      expect(options[1].graceDays).toBe(90)
    })

    it('should not call the LLM nor create a log', async () => {
      await sut.execute({ ...base, input: { type: 'manual', options: [cdbA] } })

      expect(fakeLlmGateway.calls).toHaveLength(0)
      expect(inMemoryLlmLogsRepository.items).toHaveLength(0)
    })

    it('should not create a comparison without options', async () => {
      const result = await sut.execute({
        ...base,
        input: { type: 'manual', options: [] },
      })

      expect(result.isLeft()).toBe(true)
      expect(result.value).toBeInstanceOf(NoOptionsFoundError)
      expect(inMemoryComparisonsRepository.items).toHaveLength(0)
    })
  })

  describe('LLM extraction', () => {
    it('should create the options extracted from a text', async () => {
      fakeLlmGateway.extractedOptions = [cdbA, lciB]

      const result = await sut.execute({
        ...base,
        input: { type: 'text', text: 'CDB Banco A 110% CDI...' },
      })

      expect(result.isRight()).toBe(true)
      expect(fakeLlmGateway.calls).toEqual([
        { type: 'text', text: 'CDB Banco A 110% CDI...' },
      ])

      const options = inMemoryComparisonsRepository.options
      expect(options).toHaveLength(2)
      expect(options.every((o) => o.source === DataSource.LLM_EXTRACTED)).toBe(
        true
      )
      expect(options[1].rawInput).toBe('LCI Banco B 92% CDI carência 90 dias')
    })

    it('should never come out of extraction already evaluated', async () => {
      fakeLlmGateway.extractedOptions = [cdbA]

      await sut.execute({ ...base, input: { type: 'text', text: '...' } })

      const [option] = inMemoryComparisonsRepository.options
      expect(option.isEvaluated).toBe(false)
      expect(option.alerts).toEqual([])
    })

    it('should log the LLM call linked to the comparison', async () => {
      fakeLlmGateway.extractedOptions = [cdbA]

      await sut.execute({
        ...base,
        input: { type: 'image', base64: 'aGVsbG8=', mediaType: 'image/png' },
      })

      const [comparison] = inMemoryComparisonsRepository.items
      const [log] = inMemoryLlmLogsRepository.items
      expect(log.userId.equals(userId)).toBe(true)
      expect(log.purpose).toBe(LlmPurpose.EXTRACTION)
      expect(log.model).toBe('fake-model')
      expect(log.prompt).toBe('extract: [image]')
      expect(log.inputTokens).toBe(100)
      expect(log.comparisonId?.equals(comparison.id)).toBe(true)
    })

    it('should log the call even when the response is invalid', async () => {
      fakeLlmGateway.extractedOptions = null

      const result = await sut.execute({
        ...base,
        input: { type: 'text', text: '...' },
      })

      expect(result.isLeft()).toBe(true)
      expect(result.value).toBeInstanceOf(ExtractionFailedError)
      expect(inMemoryComparisonsRepository.items).toHaveLength(0)
      expect(inMemoryLlmLogsRepository.items).toHaveLength(1)
      expect(inMemoryLlmLogsRepository.items[0].comparisonId).toBeNull()
      expect(inMemoryLlmLogsRepository.items[0].response).toEqual({
        options: 'garbage',
      })
    })

    it('should log the call when nothing was found', async () => {
      fakeLlmGateway.extractedOptions = []

      const result = await sut.execute({
        ...base,
        input: { type: 'text', text: 'texto sem investimentos' },
      })

      expect(result.isLeft()).toBe(true)
      expect(result.value).toBeInstanceOf(NoOptionsFoundError)
      expect(inMemoryComparisonsRepository.items).toHaveLength(0)
      expect(inMemoryLlmLogsRepository.items).toHaveLength(1)
    })

    it('should return unavailable when the LLM is down', async () => {
      fakeLlmGateway.unavailable = true

      const result = await sut.execute({
        ...base,
        input: { type: 'text', text: '...' },
      })

      expect(result.isLeft()).toBe(true)
      expect(result.value).toBeInstanceOf(LlmUnavailableError)
      expect(inMemoryComparisonsRepository.items).toHaveLength(0)
      expect(inMemoryLlmLogsRepository.items).toHaveLength(0)
    })
  })
})
