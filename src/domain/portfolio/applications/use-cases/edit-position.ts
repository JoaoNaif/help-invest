import Decimal from 'decimal.js'
import { Either, left, right } from '@/core/either'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import { Position } from '../../entities/position'
import { PositionsRepository } from '../repositories/positions-repository'

/**
 * Campo ausente (`undefined`) = não altera · `null` = limpa · valor = altera.
 */
interface EditPositionUseCaseRequest {
  userId: string
  positionId: string
  assetType?: AssetType
  name?: string
  investedAmount?: Decimal
  issuerName?: string | null
  issuerCnpj?: string | null
  indexer?: Indexer | null
  rate?: Decimal | null
  investedAt?: Date | null
  maturityAt?: Date | null
  liquidity?: Liquidity | null
}

type EditPositionUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  { position: Position }
>

/** UC-09 — ver docs/08-casos-de-uso.md#uc-09--editposition */
export class EditPositionUseCase {
  constructor(private positionsRepository: PositionsRepository) {}

  async execute({
    userId,
    positionId,
    ...changes
  }: EditPositionUseCaseRequest): Promise<EditPositionUseCaseResponse> {
    const position = await this.positionsRepository.findById(positionId)

    if (!position) {
      return left(new ResourceNotFoundError('Position'))
    }

    if (position.userId.toString() !== userId) {
      return left(new NotAllowedError())
    }

    if (changes.assetType !== undefined) {
      position.assetType = changes.assetType
    }
    if (changes.name !== undefined) {
      position.name = changes.name
    }
    if (changes.investedAmount !== undefined) {
      position.investedAmount = changes.investedAmount
    }
    if (changes.issuerName !== undefined) {
      position.issuerName = changes.issuerName
    }
    if (changes.issuerCnpj !== undefined) {
      position.issuerCnpj = changes.issuerCnpj
    }
    if (changes.indexer !== undefined) {
      position.indexer = changes.indexer
    }
    if (changes.rate !== undefined) {
      position.rate = changes.rate
    }
    if (changes.investedAt !== undefined) {
      position.investedAt = changes.investedAt
    }
    if (changes.maturityAt !== undefined) {
      position.maturityAt = changes.maturityAt
    }
    if (changes.liquidity !== undefined) {
      position.liquidity = changes.liquidity
    }

    await this.positionsRepository.save(position)

    return right({ position })
  }
}
