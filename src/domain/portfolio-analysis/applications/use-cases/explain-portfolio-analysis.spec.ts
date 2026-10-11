import { beforeEach, describe, expect, it } from 'vitest'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { ExplanationFailedError } from '@/domain/comparison/applications/errors/explanation-failed-error'
import { LlmUnavailableError } from '@/domain/comparison/applications/errors/llm-unavailable-error'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import {
  makePortfolioAnalysis,
  makePortfolioAnalysisReport,
} from 'test/factories/make-portfolio-analysis'
import { FakeLlmGateway } from 'test/gateways/fake-llm-gateway'
import { InMemoryLlmLogsRepository } from 'test/repositories/in-memory-llm-logs-repository'
import { InMemoryPortfolioAnalysesRepository } from 'test/repositories/in-memory-portfolio-analyses-repository'
import { readPortfolioExplanation } from '../mappers/portfolio-explanation-log-response'
import { ExplainPortfolioAnalysisUseCase } from './explain-portfolio-analysis'

let analyses: InMemoryPortfolioAnalysesRepository
let llm: FakeLlmGateway
let llmLogs: InMemoryLlmLogsRepository
let sut: ExplainPortfolioAnalysisUseCase

function makeAnalysis() {
  return makePortfolioAnalysis({
    result: makePortfolioAnalysisReport({
      total: '10000.00',
      current: [
        { assetClass: 'FIXED_POST', amount: '10000.00', percentage: '100.00' },
      ],
      reserve: {
        recommended: '60000.00',
        current: '10000.00',
        gap: '50000.00',
        isBelowRecommended: true,
      },
      alerts: [
        {
          code: 'ISSUER_CONCENTRATION',
          severity: 'WARNING',
          message: 'Banco X (CNPJ 12345678000199) concentra 100% da carteira.',
        },
      ],
    }),
  })
}

describe('Explain Portfolio Analysis', () => {
  beforeEach(() => {
    analyses = new InMemoryPortfolioAnalysesRepository()
    llm = new FakeLlmGateway()
    llmLogs = new InMemoryLlmLogsRepository()
    sut = new ExplainPortfolioAnalysisUseCase(analyses, llm, llmLogs)
  })

  it('should be able to explain and log the call', async () => {
    const analysis = makeAnalysis()
    analyses.items.push(analysis)

    const result = await sut.execute({
      userId: analysis.userId.toString(),
      portfolioAnalysisId: analysis.id.toString(),
    })

    expect(result.isRight()).toBe(true)
    expect(result.isRight() && result.value.explanation.summary).toBe(
      'Sua carteira está concentrada em renda fixa pós-fixada.'
    )

    expect(llmLogs.items).toHaveLength(1)

    const [log] = llmLogs.items

    expect(log.purpose).toBe(LlmPurpose.PORTFOLIO_EXPLANATION)
    expect(log.portfolioAnalysisId?.toString()).toBe(analysis.id.toString())
    expect(log.userId.toString()).toBe(analysis.userId.toString())
    expect(readPortfolioExplanation(log.response)?.summary).toContain(
      'renda fixa'
    )
  })

  it('should send only percentages and codes to the LLM', async () => {
    const analysis = makeAnalysis()
    analyses.items.push(analysis)

    await sut.execute({
      userId: analysis.userId.toString(),
      portfolioAnalysisId: analysis.id.toString(),
    })

    const [input] = llm.explainPortfolioCalls
    const sent = JSON.stringify(input)

    expect(input.reserveIsBelowRecommended).toBe(true)
    expect(input.alerts).toEqual([
      { code: 'ISSUER_CONCENTRATION', severity: 'WARNING' },
    ])
    expect(input.current).toEqual([
      { assetClass: 'FIXED_POST', percentage: '100.00' },
    ])
    // sem valores em reais, reserva, emissor nem CNPJ
    expect(sent).not.toContain('10000')
    expect(sent).not.toContain('60000')
    expect(sent).not.toContain('50000')
    expect(sent).not.toContain('12345678000199')
    expect(sent).not.toContain('Banco X')
  })

  it('should drop highlights of classes the LLM made up', async () => {
    const analysis = makeAnalysis()
    analyses.items.push(analysis)

    llm.portfolioExplanation = {
      summary: 'Resumo.',
      highlights: [
        { assetClass: 'PETR4' as never, text: 'Compre PETR4' },
        { assetClass: 'STOCKS', text: 'Abaixo da faixa.' },
      ],
      attentionPoints: ['a', 'b', 'c', 'd'],
    }

    const result = await sut.execute({
      userId: analysis.userId.toString(),
      portfolioAnalysisId: analysis.id.toString(),
    })

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      expect(result.value.explanation.highlights).toEqual([
        { assetClass: 'STOCKS', text: 'Abaixo da faixa.' },
      ])
      expect(result.value.explanation.attentionPoints).toHaveLength(3)
    }
  })

  it('should log an invalid answer and return ExplanationFailedError', async () => {
    const analysis = makeAnalysis()
    analyses.items.push(analysis)
    llm.portfolioExplanation = null

    const result = await sut.execute({
      userId: analysis.userId.toString(),
      portfolioAnalysisId: analysis.id.toString(),
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ExplanationFailedError)
    expect(llmLogs.items).toHaveLength(1)
    expect(readPortfolioExplanation(llmLogs.items[0].response)).toBeNull()
  })

  it('should return LlmUnavailableError and not log when the LLM is down', async () => {
    const analysis = makeAnalysis()
    analyses.items.push(analysis)
    llm.unavailable = true

    const result = await sut.execute({
      userId: analysis.userId.toString(),
      portfolioAnalysisId: analysis.id.toString(),
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(LlmUnavailableError)
    expect(llmLogs.items).toHaveLength(0)
  })

  it('should not be able to explain an analysis that does not exist', async () => {
    const result = await sut.execute({
      userId: 'user-1',
      portfolioAnalysisId: 'missing',
    })

    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
    expect(llm.explainPortfolioCalls).toHaveLength(0)
  })

  it('should not be able to explain the analysis of another user', async () => {
    const analysis = makeAnalysis()
    analyses.items.push(analysis)

    const result = await sut.execute({
      userId: 'someone-else',
      portfolioAnalysisId: analysis.id.toString(),
    })

    expect(result.value).toBeInstanceOf(NotAllowedError)
    // não gasta crédito do LLM com análise alheia
    expect(llm.explainPortfolioCalls).toHaveLength(0)
  })
})
