import { Position } from '@/domain/portfolio/entities/position'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { AssetClass } from '../entities/enums/asset-class'

/** Tipos de renda fixa: a classe depende do indexador. */
export const FIXED_INCOME_ASSET_TYPES: readonly AssetType[] = [
  AssetType.CDB,
  AssetType.LCI,
  AssetType.LCA,
  AssetType.LC,
  AssetType.TESOURO,
  AssetType.DEBENTURE,
  AssetType.CRI,
  AssetType.CRA,
]

/** Posição → classe de ativo. Puro e determinístico. */
export class AssetClassifier {
  static classify(
    position: Pick<Position, 'assetType' | 'indexer'>
  ): AssetClass {
    const { assetType, indexer } = position

    if (FIXED_INCOME_ASSET_TYPES.includes(assetType)) {
      switch (indexer) {
        case Indexer.CDI:
        case Indexer.SELIC:
          return AssetClass.FIXED_POST
        case Indexer.IPCA:
          return AssetClass.FIXED_INFLATION
        case Indexer.PRE:
          return AssetClass.FIXED_PRE
        default:
          // Renda fixa sem indexador: o motor não sabe como se comporta.
          return AssetClass.OTHER
      }
    }

    switch (assetType) {
      case AssetType.ACAO:
        return AssetClass.STOCKS
      case AssetType.FII:
        return AssetClass.REAL_ESTATE_FUNDS
      case AssetType.FUNDO:
        return AssetClass.FUNDS
      case AssetType.CRIPTO:
        return AssetClass.CRYPTO
      default:
        return AssetClass.OTHER
    }
  }
}
