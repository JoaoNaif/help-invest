import Decimal from 'decimal.js'
import { AssetType } from '../enums/asset-type'

/**
 * Fundo Garantidor de Créditos (FGC).
 * Fonte: Estatuto do FGC (Resolução CMN 4.222/2013) — https://www.fgc.org.br
 * Vigência conferida em: 2026-10-06.
 *
 * O limite vale por CPF **por instituição/conglomerado**. O sistema agrupa por
 * CNPJ do emissor — simplificação: emissores do mesmo conglomerado não são
 * somados. O teto global (R$ 1 milhão a cada 4 anos) fica fora do MVP.
 */
export const FGC_LIMIT_PER_ISSUER = new Decimal('250000')

/** Tipos do sistema cobertos pelo FGC. Tesouro, debêntures, CRI/CRA, ações, FIIs, fundos e cripto não são. */
export const FGC_COVERED_ASSET_TYPES: readonly AssetType[] = [
  AssetType.CDB,
  AssetType.LCI,
  AssetType.LCA,
  AssetType.LC,
]

export function isCoveredByFgc(assetType: AssetType) {
  return FGC_COVERED_ASSET_TYPES.includes(assetType)
}
