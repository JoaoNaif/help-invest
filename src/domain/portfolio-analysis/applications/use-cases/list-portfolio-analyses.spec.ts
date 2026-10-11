import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { makePortfolioAnalysis } from 'test/factories/make-portfolio-analysis'
import { InMemoryPortfolioAnalysesRepository } from 'test/repositories/in-memory-portfolio-analyses-repository'
import {
  ListPortfolioAnalysesUseCase,
  PORTFOLIO_ANALYSES_PER_PAGE,
} from './list-portfolio-analyses'

let analyses: InMemoryPortfolioAnalysesRepository
let sut: ListPortfolioAnalysesUseCase

describe('List Portfolio Analyses', () => {
  beforeEach(() => {
    analyses = new InMemoryPortfolioAnalysesRepository()
    sut = new ListPortfolioAnalysesUseCase(analyses)
  })

  it('should list only the analyses of the user, newest first', async () => {
    const userId = new UniqueEntityId()

    analyses.items.push(
      makePortfolioAnalysis({
        userId,
        createdAt: new Date('2026-10-01T00:00:00Z'),
      }),
      makePortfolioAnalysis({
        userId,
        createdAt: new Date('2026-10-03T00:00:00Z'),
      }),
      makePortfolioAnalysis({
        createdAt: new Date('2026-10-05T00:00:00Z'),
      })
    )

    const result = await sut.execute({ userId: userId.toString() })

    expect(
      result.value.analyses.map((analysis) => analysis.createdAt.toISOString())
    ).toEqual(['2026-10-03T00:00:00.000Z', '2026-10-01T00:00:00.000Z'])
  })

  it('should paginate the history', async () => {
    const userId = new UniqueEntityId()

    for (let index = 0; index < PORTFOLIO_ANALYSES_PER_PAGE + 5; index++) {
      analyses.items.push(
        makePortfolioAnalysis({
          userId,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        })
      )
    }

    const first = await sut.execute({ userId: userId.toString(), page: 1 })
    const second = await sut.execute({ userId: userId.toString(), page: 2 })

    expect(first.value.analyses).toHaveLength(PORTFOLIO_ANALYSES_PER_PAGE)
    expect(second.value.analyses).toHaveLength(5)
  })
})
