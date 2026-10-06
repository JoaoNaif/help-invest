import Decimal from 'decimal.js'
import {
  INCOME_TAX_BRACKETS,
  INCOME_TAX_EXEMPT_ASSET_TYPES,
} from '@/domain/shared/constants/income-tax'
import { AssetType } from '@/domain/shared/enums/asset-type'

const DAYS_PER_YEAR = 365

/**
 * IR de renda fixa e taxa líquida — puro, sem banco nem LLM.
 * Ver docs/08-casos-de-uso.md#serviços-de-domínio-motor-de-regras
 */
export class IncomeTaxCalculator {
  /** Alíquota em % (0 se isento). */
  static rateFor(assetType: AssetType, holdingDays: number): Decimal {
    if (INCOME_TAX_EXEMPT_ASSET_TYPES.includes(assetType)) {
      return new Decimal(0)
    }

    const bracket = INCOME_TAX_BRACKETS.find(
      ({ upToDays }) => holdingDays <= upToDays
    )

    // A última faixa é Infinity, então sempre existe.
    return bracket!.rate
  }

  /**
   * Taxa líquida % a.a. O IR incide sobre o **ganho do período**, não sobre a
   * taxa anual: capitaliza o bruto no prazo, desconta o IR e reanualiza.
   */
  static netAnnualRate(
    grossAnnualRate: Decimal,
    taxRate: Decimal,
    holdingDays: number
  ): Decimal {
    const years = new Decimal(holdingDays).div(DAYS_PER_YEAR)

    const grossPeriodGain = grossAnnualRate.div(100).plus(1).pow(years).minus(1)

    const netPeriodGain = grossPeriodGain.times(
      new Decimal(1).minus(taxRate.div(100))
    )

    return netPeriodGain
      .plus(1)
      .pow(new Decimal(1).div(years))
      .minus(1)
      .times(100)
      .toDecimalPlaces(6)
  }
}
