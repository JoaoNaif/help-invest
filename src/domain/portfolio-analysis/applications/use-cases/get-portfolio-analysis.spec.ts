import { beforeEach, describe, expect, it } from 'vitest'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { makeLlmLog } from 'test/factories/make-llm-log'
import { makePortfolioAnalysis } from 'test/factories/make-portfolio-analysis'
import { InMemoryLlmLogsRepository } from 'test/repositories/in-memory-llm-logs-repository'
import { InMemoryPortfolioAnalysesRepository } from 'test/repositories/in-memory-portfolio-analyses-repository'
import { toPortfolioExplanationLogResponse } from '../mappers/portfolio-explanation-log-response'
import { GetPortfolioAnalysisUseCase } from './get-portfolio-analysis'

let analyses: InMemoryPortfolioAnalysesRepository
let llmLogs: InMemoryLlmLogsRepository
let sut: GetPortfolioAnalysisUseCase

describe('Get Portfolio Analysis', () => {
  beforeEach(() => {
    analyses = new InMemoryPortfolioAnalysesRepository()
    llmLogs = new InMemoryLlmLogsRepository()
    sut = new GetPortfolioAnalysisUseCase(analyses, llmLogs)
  })

  it('should be able to get an analysis of the user', async () => {
    const analysis = makePortfolioAnalysis()
    analyses.items.push(analysis)

    const result = await sut.execute({
      userId: analysis.userId.toString(),
      portfolioAnalysisId: analysis.id.toString(),
    })

    expect(result.isRight()).toBe(true)
    expect(result.isRight() && result.value.analysis).toBe(analysis)
    expect(result.isRight() && result.value.explanation).toBeNull()
  })

  it('should return the latest valid explanation', async () => {
    const analysis = makePortfolioAnalysis()
    analyses.items.push(analysis)

    llmLogs.items.push(
      makeLlmLog({
        userId: analysis.userId,
        purpose: LlmPurpose.PORTFOLIO_EXPLANATION,
        portfolioAnalysisId: analysis.id,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        response: toPortfolioExplanationLogResponse(
          { summary: 'Antiga.', highlights: [], attentionPoints: [] },
          {}
        ),
      }),
      makeLlmLog({
        userId: analysis.userId,
        purpose: LlmPurpose.PORTFOLIO_EXPLANATION,
        portfolioAnalysisId: analysis.id,
        createdAt: new Date('2026-10-02T10:00:00Z'),
        response: toPortfolioExplanationLogResponse(
          { summary: 'Recente.', highlights: [], attentionPoints: [] },
          {}
        ),
      }),
      // tentativa mais nova, mas que falhou: não vale
      makeLlmLog({
        userId: analysis.userId,
        purpose: LlmPurpose.PORTFOLIO_EXPLANATION,
        portfolioAnalysisId: analysis.id,
        createdAt: new Date('2026-10-03T10:00:00Z'),
        response: toPortfolioExplanationLogResponse(null, {}),
      })
    )

    const result = await sut.execute({
      userId: analysis.userId.toString(),
      portfolioAnalysisId: analysis.id.toString(),
    })

    expect(result.isRight() && result.value.explanation?.summary).toBe(
      'Recente.'
    )
  })

  it('should not use the explanation of another analysis or purpose', async () => {
    const analysis = makePortfolioAnalysis()
    const other = makePortfolioAnalysis({ userId: analysis.userId })
    analyses.items.push(analysis, other)

    llmLogs.items.push(
      makeLlmLog({
        userId: analysis.userId,
        purpose: LlmPurpose.PORTFOLIO_EXPLANATION,
        portfolioAnalysisId: other.id,
        response: toPortfolioExplanationLogResponse(
          { summary: 'De outra.', highlights: [], attentionPoints: [] },
          {}
        ),
      }),
      makeLlmLog({
        userId: analysis.userId,
        purpose: LlmPurpose.EXPLANATION,
        portfolioAnalysisId: analysis.id,
      })
    )

    const result = await sut.execute({
      userId: analysis.userId.toString(),
      portfolioAnalysisId: analysis.id.toString(),
    })

    expect(result.isRight() && result.value.explanation).toBeNull()
  })

  it('should not be able to get an analysis that does not exist', async () => {
    const result = await sut.execute({
      userId: 'user-1',
      portfolioAnalysisId: 'missing',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
  })

  it('should not be able to get the analysis of another user', async () => {
    const analysis = makePortfolioAnalysis()
    analyses.items.push(analysis)

    const result = await sut.execute({
      userId: 'someone-else',
      portfolioAnalysisId: analysis.id.toString(),
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(NotAllowedError)
  })
})
