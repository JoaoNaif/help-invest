import Decimal from 'decimal.js'
import { Indexer } from '@/domain/shared/enums/indexer'

/** Índices de referência, em % a.a. */
export interface MarketReference {
  /** CDI anualizado base 252. */
  cdi: Decimal
  /** Meta Selic. */
  selic: Decimal
  /** IPCA acumulado nos últimos 12 meses. `null` se nenhuma opção usa IPCA. */
  ipca12m: Decimal | null
}

/**
 * Converte a taxa ofertada em **taxa bruta % a.a.** — puro, sem banco nem LLM.
 * Ver docs/08-casos-de-uso.md#serviços-de-domínio-motor-de-regras
 *
 * | Indexador | `rate` significa | Conta |
 * |---|---|---|
 * | PRE   | % a.a.          | rate |
 * | CDI   | % do CDI        | rate/100 × CDI (aproximação usual) |
 * | SELIC | % da Selic      | rate/100 × Selic |
 * | IPCA  | spread sobre IPCA | (1 + IPCA 12m) × (1 + rate) − 1 |
 */
export class RateNormalizer {
  static grossAnnualRate(
    indexer: Indexer,
    rate: Decimal,
    market: MarketReference
  ): Decimal {
    switch (indexer) {
      case Indexer.PRE:
        return rate

      case Indexer.CDI:
        return rate.div(100).times(market.cdi)

      case Indexer.SELIC:
        return rate.div(100).times(market.selic)

      case Indexer.IPCA: {
        // Invariante: o use-case só deixa ipca12m nulo se nenhuma opção usa IPCA.
        if (!market.ipca12m) {
          throw new Error('IPCA 12m is required to normalize IPCA+ rates.')
        }

        const inflation = market.ipca12m.div(100).plus(1)
        const spread = rate.div(100).plus(1)

        return inflation.times(spread).minus(1).times(100)
      }
    }
  }

  /** Acumula variações mensais (%) em uma variação no período (%). */
  static accumulate(monthlyRates: Decimal[]): Decimal {
    return monthlyRates
      .reduce((acc, rate) => acc.times(rate.div(100).plus(1)), new Decimal(1))
      .minus(1)
      .times(100)
  }
}
