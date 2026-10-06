import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { makePosition } from 'test/factories/make-position'
import { InMemoryPositionsRepository } from 'test/repositories/in-memory-positions-repository'
import { ListPositionsUseCase } from './list-positions'

let inMemoryPositionsRepository: InMemoryPositionsRepository
let sut: ListPositionsUseCase

describe('List Positions', () => {
  const userId = new UniqueEntityId()

  beforeEach(() => {
    inMemoryPositionsRepository = new InMemoryPositionsRepository()
    sut = new ListPositionsUseCase(inMemoryPositionsRepository)
  })

  it('should list only the positions of the user', async () => {
    await inMemoryPositionsRepository.create(makePosition({ userId }))
    await inMemoryPositionsRepository.create(makePosition({ userId }))
    await inMemoryPositionsRepository.create(makePosition())

    const result = await sut.execute({ userId: userId.toString() })

    expect(result.isRight()).toBe(true)
    expect(result.value?.positions).toHaveLength(2)
    expect(
      result.value?.positions.every((position) =>
        position.userId.equals(userId)
      )
    ).toBe(true)
  })

  it('should list the most recent positions first', async () => {
    await inMemoryPositionsRepository.create(
      makePosition({
        userId,
        name: 'antiga',
        createdAt: new Date('2026-01-01'),
      })
    )
    await inMemoryPositionsRepository.create(
      makePosition({ userId, name: 'nova', createdAt: new Date('2026-09-01') })
    )
    await inMemoryPositionsRepository.create(
      makePosition({ userId, name: 'meio', createdAt: new Date('2026-05-01') })
    )

    const result = await sut.execute({ userId: userId.toString() })

    expect(result.value?.positions.map((position) => position.name)).toEqual([
      'nova',
      'meio',
      'antiga',
    ])
  })

  it('should return an empty list when the user has no positions', async () => {
    const result = await sut.execute({ userId: userId.toString() })

    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual({ positions: [] })
  })
})
