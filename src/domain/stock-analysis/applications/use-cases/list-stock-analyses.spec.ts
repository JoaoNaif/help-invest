import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { makeStockAnalysis } from 'test/factories/make-stock-analysis'
import { InMemoryStockAnalysesRepository } from 'test/repositories/in-memory-stock-analyses-repository'
import {
  ListStockAnalysesUseCase,
  STOCK_ANALYSES_PER_PAGE,
} from './list-stock-analyses'

let repository: InMemoryStockAnalysesRepository
let sut: ListStockAnalysesUseCase

describe('List Stock Analyses', () => {
  beforeEach(() => {
    repository = new InMemoryStockAnalysesRepository()
    sut = new ListStockAnalysesUseCase(repository)
  })

  it('should list only the analyses of the user, newest first', async () => {
    const userId = new UniqueEntityId('user-1')
    const older = makeStockAnalysis({
      userId,
      createdAt: new Date('2026-10-01T00:00:00Z'),
    })
    const newer = makeStockAnalysis({
      userId,
      createdAt: new Date('2026-10-05T00:00:00Z'),
    })
    repository.items.push(older, newer, makeStockAnalysis())

    const result = await sut.execute({ userId: 'user-1' })

    expect(result.isRight() && result.value.analyses).toEqual([newer, older])
  })

  it('should paginate the history', async () => {
    const userId = new UniqueEntityId('user-1')

    for (let i = 0; i < STOCK_ANALYSES_PER_PAGE + 3; i++) {
      repository.items.push(
        makeStockAnalysis({ userId, createdAt: new Date(2026, 0, 1 + i) })
      )
    }

    const first = await sut.execute({ userId: 'user-1', page: 1 })
    const second = await sut.execute({ userId: 'user-1', page: 2 })

    expect(first.isRight() && first.value.analyses).toHaveLength(
      STOCK_ANALYSES_PER_PAGE
    )
    expect(second.isRight() && second.value.analyses).toHaveLength(3)
  })
})
