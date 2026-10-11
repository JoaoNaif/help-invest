import Decimal from 'decimal.js'
import { INCOME_TAX_BRACKETS } from '@/domain/shared/constants/income-tax'
import {
  TaxExemptBracket,
  TaxExemptEquivalence as TaxExemptEquivalenceResult,
} from '../applications/dtos/market-overview'

/** Regra do produto (não é norma): % do CDI típico de uma LCA/LCI para comparar. */
export const DEFAULT_EXEMPT_PERCENT_OF_CDI = new Decimal(90)

export const TAX_EXEMPT_NOTE =
  'Quanto um CDB (com IR) precisa pagar, em % do CDI, para render o mesmo que uma LCA/LCI isenta.'

/**
 * Equivalência LCA/LCI × CDB — puro. Usa a tabela de IR regressivo que o
 * comparador já usa (`shared/constants/income-tax`); não há segunda cópia.
 * `equivalente = isento / (1 − IR)`.
 */
export class TaxExemptEquivalence {
  static compute(exemptPercentOfCdi: Decimal): TaxExemptEquivalenceResult {
    return {
      kind: 'TAX_EXEMPT_VS_TAXED',
      exemptPercentOfCdi: exemptPercentOfCdi.toFixed(2),
      brackets: INCOME_TAX_BRACKETS.map((bracket, index): TaxExemptBracket => ({
        label: labelOf(
          bracket.upToDays,
          index === 0 ? null : INCOME_TAX_BRACKETS[index - 1].upToDays
        ),
        incomeTaxRate: bracket.rate.toFixed(2),
        equivalentTaxedPercentOfCdi: exemptPercentOfCdi
          .div(new Decimal(1).minus(bracket.rate.div(100)))
          .toFixed(2),
      })),
      note: TAX_EXEMPT_NOTE,
    }
  }
}

function labelOf(upToDays: number, previousUpToDays: number | null) {
  if (previousUpToDays === null) return `até ${upToDays} dias`

  if (!Number.isFinite(upToDays)) return `acima de ${previousUpToDays} dias`

  return `${previousUpToDays + 1} a ${upToDays} dias`
}
