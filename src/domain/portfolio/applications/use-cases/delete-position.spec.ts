import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { makePosition } from 'test/factories/make-position'
import { InMemoryPositionsRepository } from 'test/repositories/in-memory-positions-repository'
import { DeletePositionUseCase } from './delete-position'

let inMemoryPositionsRepository: InMemoryPositionsRepository
let sut: DeletePositionUseCase

describe('Delete Position', () => {
  const userId = new UniqueEntityId()

  beforeEach(() => {
    inMemoryPositionsRepository = new InMemoryPositionsRepository()
    sut = new DeletePositionUseCase(inMemoryPositionsRepository)
  })

  it('should be able to delete a position', async () => {
    const position = makePosition({ userId })
    await inMemoryPositionsRepository.create(position)

    const result = await sut.execute({
      userId: userId.toString(),
      positionId: position.id.toString(),
    })

    expect(result.isRight()).toBe(true)
    expect(inMemoryPositionsRepository.items).toHaveLength(0)
  })

  it('should only delete the given position', async () => {
    const position = makePosition({ userId })
    const otherPosition = makePosition({ userId })
    await inMemoryPositionsRepository.create(position)
    await inMemoryPositionsRepository.create(otherPosition)

    await sut.execute({
      userId: userId.toString(),
      positionId: position.id.toString(),
    })

    expect(inMemoryPositionsRepository.items).toEqual([otherPosition])
  })

  it('should not be able to delete a position from another user', async () => {
    const position = makePosition()
    await inMemoryPositionsRepository.create(position)

    const result = await sut.execute({
      userId: userId.toString(),
      positionId: position.id.toString(),
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(NotAllowedError)
    expect(inMemoryPositionsRepository.items).toHaveLength(1)
  })

  it('should return not found for an unknown position', async () => {
    const result = await sut.execute({
      userId: userId.toString(),
      positionId: 'unknown-id',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
  })
})
