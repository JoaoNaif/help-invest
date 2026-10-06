import Decimal from 'decimal.js'
import { Either, right } from '@/core/either'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { DataSource } from '@/domain/shared/enums/data-source'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import { Position } from '../../entities/position'
import { PositionsRepository } from '../repositories/positions-repository'

interface CreatePositionUseCaseRequest {
  userId: string
  assetType: AssetType
  name: string
  investedAmount: Decimal
  issuerName?: string | null
  issuerCnpj?: string | null
  indexer?: Indexer | null
  rate?: Decimal | null
  investedAt?: Date | null
  maturityAt?: Date | null
  liquidity?: Liquidity | null
}

type CreatePositionUseCaseResponse = Either<never, { position: Position }>

/**
 * UC-08 — ver docs/08-casos-de-uso.md#uc-08--createposition
 * Cadastro manual: `source` é sempre MANUAL. Validação de formato
 * (valor > 0, CNPJ com 14 dígitos, datas) fica no Zod do controller.
 */
export class CreatePositionUseCase {
  constructor(private positionsRepository: PositionsRepository) {}

  async execute({
    userId,
    ...data
  }: CreatePositionUseCaseRequest): Promise<CreatePositionUseCaseResponse> {
    const position = Position.create({
      ...data,
      userId: new UniqueEntityId(userId),
      source: DataSource.MANUAL,
    })

    await this.positionsRepository.create(position)

    return right({ position })
  }
}
