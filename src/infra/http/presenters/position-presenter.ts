import { Position } from '@/domain/portfolio/entities/position'
import { formatDateOnly } from '../schemas/common'

export class PositionPresenter {
  static toHTTP(position: Position) {
    return {
      id: position.id.toString(),
      assetType: position.assetType,
      name: position.name,
      issuerName: position.issuerName,
      issuerCnpj: position.issuerCnpj,
      investedAmount: position.investedAmount.toString(),
      indexer: position.indexer,
      rate: position.rate?.toString() ?? null,
      investedAt: formatDateOnly(position.investedAt),
      maturityAt: formatDateOnly(position.maturityAt),
      liquidity: position.liquidity,
      source: position.source,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    }
  }
}
