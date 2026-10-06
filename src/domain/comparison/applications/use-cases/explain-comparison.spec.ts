import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { AlertSeverity } from '@/domain/shared/enums/alert-severity'
import { makeComparison } from 'test/factories/make-comparison'
import { makeComparisonOption } from 'test/factories/make-comparison-option'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'
import { FakeLlmGateway } from 'test/gateways/fake-llm-gateway'
import { InMemoryComparisonsRepository } from 'test/repositories/in-memory-comparisons-repository'
import { InMemoryInvestorProfilesRepository } from 'test/repositories/in-memory-investor-profiles-repository'
import { InMemoryLlmLogsRepository } from 'test/repositories/in-memory-llm-logs-repository'
import { Comparison } from '../../entities/comparison'
import { ExplanationFailedError } from '../errors/explanation-failed-error'
import { InvalidComparisonStatusError } from '../errors/invalid-comparison-status-error'
import { LlmUnavailableError } from '../errors/llm-unavailable-error'
import { ExplainComparisonUseCase } from './explain-comparison'

let comparisonsRepository: InMemoryComparisonsRepository
let investorProfilesRepository: InMemoryInvestorProfilesRepository
let llmLogsRepository: InMemoryLlmLogsRepository
let fakeLlmGateway: FakeLlmGateway
let sut: ExplainComparisonUseCase

const userId = new UniqueEntityId()

const fgcAlert = {
  code: 'ABOVE_FGC_LIMIT',
  severity: AlertSeverity.DANGER,
  message: 'R$ 10.000,00 sem garantia.',
}

/** Comparação já avaliada (DONE): CDB 14,08% e LCI 13,708%. */
async function createEvaluatedComparison() {
  const comparison = makeComparison({ userId, amount: new Decimal('10000') })
  const lci = makeComparisonOption({
    comparisonId: comparison.id,
    issuerName: 'Banco B',
    issuerCnpj: '22222222000122',
  })
  const cdb = makeComparisonOption({
    comparisonId: comparison.id,
    issuerName: 'Banco A',
    issuerCnpj: '11111111000111',
  })
  lci.applyEvaluation(new Decimal('13.708'), [])
  cdb.applyEvaluation(new Decimal('14.081713'), [fgcAlert])
  comparison.confirm()
  comparison.complete({ notes: ['IOF não considerado.'] })
  await comparisonsRepository.create(comparison, [lci, cdb])

  return comparison
}

function execute(comparison: Comparison, asUser = userId) {
  return sut.execute({
    userId: asUser.toString(),
    comparisonId: comparison.id.toString(),
  })
}

describe('Explain Comparison', () => {
  beforeEach(() => {
    comparisonsRepository = new InMemoryComparisonsRepository()
    investorProfilesRepository = new InMemoryInvestorProfilesRepository()
    llmLogsRepository = new InMemoryLlmLogsRepository()
    fakeLlmGateway = new FakeLlmGateway()
    sut = new ExplainComparisonUseCase(
      comparisonsRepository,
      investorProfilesRepository,
      fakeLlmGateway,
      llmLogsRepository
    )
  })

  it('should return the explanation written by the LLM', async () => {
    const comparison = await createEvaluatedComparison()

    const result = await execute(comparison)

    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual({
      explanation: 'A opção 1 rende mais líquido.',
    })
  })

  it('should send the already computed numbers, ranked, as exact text', async () => {
    const comparison = await createEvaluatedComparison()

    await execute(comparison)

    const [input] = fakeLlmGateway.explainCalls
    expect(input.amount).toBe('10000')
    expect(input.assumptions).toEqual({ notes: ['IOF não considerado.'] })
    expect(
      input.options.map((o) => [o.rank, o.issuerName, o.netAnnualRate])
    ).toEqual([
      [1, 'Banco A', '14.081713'],
      [2, 'Banco B', '13.708'],
    ])
    expect(input.options[0].alerts).toEqual([fgcAlert])
  })

  it('should send only the profile fields the explanation needs', async () => {
    await investorProfilesRepository.create(
      makeInvestorProfile({
        userId,
        goal: InvestmentGoal.PURCHASE,
        riskTolerance: RiskTolerance.LOW,
        horizonMonths: 18,
        monthlyIncome: new Decimal('12345'),
      })
    )
    const comparison = await createEvaluatedComparison()

    await execute(comparison)

    const [input] = fakeLlmGateway.explainCalls
    expect(input.investor).toEqual({
      goal: InvestmentGoal.PURCHASE,
      riskTolerance: RiskTolerance.LOW,
      horizonMonths: 18,
    })

    const sent = JSON.stringify(input)
    expect(sent).not.toContain('12345')
    expect(sent).not.toContain('11111111000111')
    expect(sent).not.toContain(userId.toString())
  })

  it('should log the call linked to the comparison', async () => {
    const comparison = await createEvaluatedComparison()

    await execute(comparison)

    const [log] = llmLogsRepository.items
    expect(log.purpose).toBe(LlmPurpose.EXPLANATION)
    expect(log.userId.equals(userId)).toBe(true)
    expect(log.comparisonId?.equals(comparison.id)).toBe(true)
    expect(log.response).toEqual({
      explanation: 'A opção 1 rende mais líquido.',
      raw: { text: 'A opção 1 rende mais líquido.' },
    })
  })

  it('should log the call even when the explanation comes back empty', async () => {
    fakeLlmGateway.explanation = '   '
    const comparison = await createEvaluatedComparison()

    const result = await execute(comparison)

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ExplanationFailedError)
    expect(llmLogsRepository.items).toHaveLength(1)
  })

  it('should return unavailable when the LLM is down', async () => {
    fakeLlmGateway.unavailable = true
    const comparison = await createEvaluatedComparison()

    const result = await execute(comparison)

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(LlmUnavailableError)
    expect(llmLogsRepository.items).toHaveLength(0)
  })

  it('should only explain an evaluated comparison', async () => {
    const draft = makeComparison({ userId })
    await comparisonsRepository.create(draft, [])

    const result = await execute(draft)

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InvalidComparisonStatusError)
    expect(fakeLlmGateway.explainCalls).toHaveLength(0)
  })

  it('should not explain a comparison from another user', async () => {
    const comparison = await createEvaluatedComparison()

    const result = await execute(comparison, new UniqueEntityId())

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(NotAllowedError)
    expect(fakeLlmGateway.explainCalls).toHaveLength(0)
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
