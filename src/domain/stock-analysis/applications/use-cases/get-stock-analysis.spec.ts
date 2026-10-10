import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { makeStockAnalysis } from 'test/factories/make-stock-analysis'
import { InMemoryStockAnalysesRepository } from 'test/repositories/in-memory-stock-analyses-repository'
import { GetStockAnalysisUseCase } from './get-stock-analysis'

let repository: InMemoryStockAnalysesRepository
let sut: GetStockAnalysisUseCase

describe('Get Stock Analysis', () => {
  beforeEach(() => {
    repository = new InMemoryStockAnalysesRepository()
    sut = new GetStockAnalysisUseCase(repository)
  })

  it('should be able to get an analysis of the user', async () => {
    const analysis = makeStockAnalysis({ userId: new UniqueEntityId('user-1') })
    repository.items.push(analysis)

    const result = await sut.execute({
      userId: 'user-1',
      stockAnalysisId: analysis.id.toString(),
    })

    expect(result.isRight()).toBe(true)
    expect(result.isRight() && result.value.analysis).toBe(analysis)
  })

  it('should not be able to get an analysis that does not exist', async () => {
    const result = await sut.execute({
      userId: 'user-1',
      stockAnalysisId: 'nope',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
  })

  it('should not be able to get the analysis of another user', async () => {
    const analysis = makeStockAnalysis({ userId: new UniqueEntityId('user-2') })
    repository.items.push(analysis)

    const result = await sut.execute({
      userId: 'user-1',
      stockAnalysisId: analysis.id.toString(),
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(NotAllowedError)
  })
})
