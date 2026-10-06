import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import { makePosition } from 'test/factories/make-position'
import { InMemoryPositionsRepository } from 'test/repositories/in-memory-positions-repository'
import { EditPositionUseCase } from './edit-position'

let inMemoryPositionsRepository: InMemoryPositionsRepository
let sut: EditPositionUseCase

describe('Edit Position', () => {
  const userId = new UniqueEntityId()

  beforeEach(() => {
    inMemoryPositionsRepository = new InMemoryPositionsRepository()
    sut = new EditPositionUseCase(inMemoryPositionsRepository)
  })

  it('should be able to edit a position', async () => {
    const position = makePosition({ userId, name: 'CDB antigo' })
    await inMemoryPositionsRepository.create(position)

    const result = await sut.execute({
      userId: userId.toString(),
      positionId: position.id.toString(),
      name: 'CDB Banco X 2028',
      investedAmount: new Decimal('20000'),
      liquidity: Liquidity.DAILY,
    })

    expect(result.isRight()).toBe(true)

    const edited = inMemoryPositionsRepository.items[0]
    expect(edited.name).toBe('CDB Banco X 2028')
    expect(edited.investedAmount.equals('20000')).toBe(true)
    expect(edited.liquidity).toBe(Liquidity.DAILY)
  })

  it('should keep fields that were not sent', async () => {
    const position = makePosition({
      userId,
      issuerCnpj: '12345678000199',
      rate: new Decimal('110'),
    })
    await inMemoryPositionsRepository.create(position)

    await sut.execute({
      userId: userId.toString(),
      positionId: position.id.toString(),
      name: 'Novo nome',
    })

    const edited = inMemoryPositionsRepository.items[0]
    expect(edited.issuerCnpj).toBe('12345678000199')
    expect(edited.rate?.equals('110')).toBe(true)
  })

  it('should clear fields sent as null', async () => {
    const position = makePosition({ userId, issuerCnpj: '12345678000199' })
    await inMemoryPositionsRepository.create(position)

    await sut.execute({
      userId: userId.toString(),
      positionId: position.id.toString(),
      issuerCnpj: null,
    })

    expect(inMemoryPositionsRepository.items[0].issuerCnpj).toBeNull()
  })

  it('should update updatedAt when edited', async () => {
    const past = new Date('2026-01-01')
    const position = makePosition({ userId, updatedAt: past })
    await inMemoryPositionsRepository.create(position)

    await sut.execute({
      userId: userId.toString(),
      positionId: position.id.toString(),
      name: 'Novo nome',
    })

    expect(
      inMemoryPositionsRepository.items[0].updatedAt.getTime()
    ).toBeGreaterThan(past.getTime())
  })

  it('should not be able to edit a position from another user', async () => {
    const position = makePosition({ name: 'CDB de outro usuário' })
    await inMemoryPositionsRepository.create(position)

    const result = await sut.execute({
      userId: userId.toString(),
      positionId: position.id.toString(),
      name: 'Tentativa',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(NotAllowedError)
    expect(inMemoryPositionsRepository.items[0].name).toBe(
      'CDB de outro usuário'
    )
  })

  it('should return not found for an unknown position', async () => {
    const result = await sut.execute({
      userId: userId.toString(),
      positionId: 'unknown-id',
      name: 'Tentativa',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
  })
})
