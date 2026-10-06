import Decimal from 'decimal.js'
import { AssetType } from '../enums/asset-type'

/**
 * IR regressivo sobre o rendimento de renda fixa, por dias corridos de aplicação.
 * Fonte: Lei 11.033/2004, art. 1º. Vigência conferida em: 2026-10-06.
 * Reconferir a cada mudança legislativa sobre tributação de investimentos.
 */
export const INCOME_TAX_BRACKETS: readonly {
  upToDays: number
  rate: Decimal
}[] = [
  { upToDays: 180, rate: new Decimal('22.5') },
  { upToDays: 360, rate: new Decimal('20') },
  { upToDays: 720, rate: new Decimal('17.5') },
  { upToDays: Infinity, rate: new Decimal('15') },
]

/**
 * Isentos de IR para pessoa física.
 * Fonte: Lei 11.033/2004, art. 3º (LCI, LCA, CRI, CRA). Conferido em: 2026-10-06.
 * Debêntures incentivadas (Lei 12.431/2011) também são isentas, mas o sistema
 * ainda não distingue debênture comum de incentivada.
 */
export const INCOME_TAX_EXEMPT_ASSET_TYPES: readonly AssetType[] = [
  AssetType.LCI,
  AssetType.LCA,
  AssetType.CRI,
  AssetType.CRA,
]

/** Abaixo disso incide IOF regressivo (Decreto 6.306/2007), não calculado no MVP. */
export const IOF_FREE_AFTER_DAYS = 30
