/**
 * Classe de ativo: agrupamento por comportamento (não por produto).
 * Derivada de `assetType` + `indexer` da posição (`AssetClassifier`).
 */
export const AssetClass = {
  /** Renda fixa pós-fixada (CDI ou Selic). */
  FIXED_POST: 'FIXED_POST',
  /** Renda fixa atrelada à inflação (IPCA+). */
  FIXED_INFLATION: 'FIXED_INFLATION',
  /** Renda fixa prefixada. */
  FIXED_PRE: 'FIXED_PRE',
  STOCKS: 'STOCKS',
  REAL_ESTATE_FUNDS: 'REAL_ESTATE_FUNDS',
  /** Fundos: o motor não sabe o que tem dentro, então não têm faixa-alvo. */
  FUNDS: 'FUNDS',
  CRYPTO: 'CRYPTO',
  /** "Outro" e renda fixa sem indexador: sem faixa-alvo. */
  OTHER: 'OTHER',
} as const

export type AssetClass = (typeof AssetClass)[keyof typeof AssetClass]

/** Classes que têm faixa-alvo (e, portanto, caminho). Ordem de exibição. */
export const TARGET_ASSET_CLASSES = [
  AssetClass.FIXED_POST,
  AssetClass.FIXED_INFLATION,
  AssetClass.FIXED_PRE,
  AssetClass.STOCKS,
  AssetClass.REAL_ESTATE_FUNDS,
  AssetClass.CRYPTO,
] as const

export type TargetAssetClass = (typeof TARGET_ASSET_CLASSES)[number]

/** Renda variável: sofre o limite por horizonte e a regra da reserva. */
export const VARIABLE_INCOME_CLASSES = [
  AssetClass.STOCKS,
  AssetClass.REAL_ESTATE_FUNDS,
  AssetClass.CRYPTO,
] as const satisfies readonly TargetAssetClass[]

export function isVariableIncome(assetClass: AssetClass) {
  return (VARIABLE_INCOME_CLASSES as readonly AssetClass[]).includes(assetClass)
}
