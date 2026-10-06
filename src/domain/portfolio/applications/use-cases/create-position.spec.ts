import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { DataSource } from '@/domain/shared/enums/data-source'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import { InMemoryPositionsRepository } from 'test/repositories/in-memory-positions-repository'
import { CreatePositionUseCase } from './create-position'

let inMemoryPositionsRepository: InMemoryPositionsRepository
let sut: CreatePositionUseCase

describe('Create Position', () => {
  const userId = new UniqueEntityId()

  beforeEach(() => {
    inMemoryPositionsRepository = new InMemoryPositionsRepository()
    sut = new CreatePositionUseCase(inMemoryPositionsRepository)
  })

  it('should be able to create a fixed income position', async () => {
    const result = await sut.execute({
      userId: userId.toString(),
      assetType: AssetType.CDB,
      name: 'CDB Banco X 2028',
      investedAmount: new Decimal('15000.00'),
      issuerName: 'Banco X',
      issuerCnpj: '12345678000199',
      indexer: Indexer.CDI,
      rate: new Decimal('110'),
      investedAt: new Date('2026-01-10'),
      maturityAt: new Date('2028-01-10'),
      liquidity: Liquidity.AT_MATURITY,
    })

    expect(result.isRight()).toBe(true)
    expect(inMemoryPositionsRepository.items).toHaveLength(1)

    const position = inMemoryPositionsRepository.items[0]
    expect(result.value).toEqual({ position })
    expect(position.userId.equals(userId)).toBe(true)
    expect(position.investedAmount.equals('15000')).toBe(true)
    expect(position.rate?.equals('110')).toBe(true)
    expect(position.issuerCnpj).toBe('12345678000199')
    expect(position.liquidity).toBe(Liquidity.AT_MATURITY)
  })

  it('should be able to create a position with only the required fields', async () => {
    const result = await sut.execute({
      userId: userId.toString(),
      assetType: AssetType.ACAO,
      name: 'PETR4',
      investedAmount: new Decimal('3200.50'),
    })

    expect(result.isRight()).toBe(true)

    const position = inMemoryPositionsRepository.items[0]
    expect(position.issuerCnpj).toBeNull()
    expect(position.indexer).toBeNull()
    expect(position.rate).toBeNull()
    expect(position.maturityAt).toBeNull()
  })

  it('should always mark the position as manually entered', async () => {
    await sut.execute({
      userId: userId.toString(),
      assetType: AssetType.LCI,
      name: 'LCI Banco Y',
      investedAmount: new Decimal('5000'),
    })

    expect(inMemoryPositionsRepository.items[0].source).toBe(DataSource.MANUAL)
  })
})
