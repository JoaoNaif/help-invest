import Decimal from 'decimal.js'
import {
  DividendKind,
  StockSnapshot,
} from '@/domain/stock-analysis/applications/dtos/stock-snapshot'

/** Um provento anual de R$ 2,00 em março, de 2022 a 2026. */
function yearlyDividends() {
  return [2022, 2023, 2024, 2025, 2026].map((year) => ({
    exDate: new Date(`${year}-03-01T00:00:00Z`),
    paymentDate: null,
    amountPerShare: new Decimal('2'),
    kind: DividendKind.OTHER,
  }))
}

/**
 * Snapshot "saudável" (consenso de 13 analistas, 5 anos de proventos) para a
 * data de referência 2026-10-09; sobrescreva o que o teste precisa mudar.
 */
export function makeStockSnapshot(
  override: Partial<StockSnapshot> = {}
): StockSnapshot {
  return {
    ticker: 'BBAS3',
    name: 'Banco do Brasil S.A.',
    sector: 'Financial Services',
    price: new Decimal('25'),
    priceDate: new Date('2026-10-09T21:00:00Z'),
    fundamentals: {
      priceToEarnings: new Decimal('10'),
      priceToBook: new Decimal('1'),
      earningsPerShare: new Decimal('2.5'),
      bookValuePerShare: new Decimal('25'),
      returnOnEquity: new Decimal('12'),
    },
    dividends: yearlyDividends(),
    dividendsHistoryFrom: new Date('2016-10-09T00:00:00Z'),
    consensus: {
      analystCount: 13,
      buy: 5,
      hold: 6,
      sell: 2,
      targetPrice: new Decimal('30'),
    },
    source: 'Fake Yahoo',
    ...override,
  }
}
