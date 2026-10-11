import Decimal from 'decimal.js'
import { Either, left, right } from '@/core/either'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import {
  IndexClose,
  IndexHistory,
  MarketIndexCode,
} from '@/domain/market-overview/applications/dtos/market-index'
import { MarketIndexProvider } from '@/domain/market-overview/applications/gateways/market-index-provider'

/**
 * Séries fixas por índice. Índice sem série em `histories` vira
 * `MarketDataUnavailableError` (como a fonte fora do ar); `calls` registra
 * os índices consultados.
 */
export class FakeMarketIndexProvider implements MarketIndexProvider {
  public histories = new Map<MarketIndexCode, IndexHistory>()
  public calls: MarketIndexCode[] = []

  async getHistory(
    code: MarketIndexCode
  ): Promise<Either<MarketDataUnavailableError, IndexHistory>> {
    this.calls.push(code)

    const history = this.histories.get(code)

    if (!history) return left(new MarketDataUnavailableError('Fake index'))

    return right(history)
  }
}

/**
 * Série diária crescente de `days` fechamentos terminando em `lastDate`
 * (um por dia corrido), de `startClose` a `endClose`.
 */
export function makeIndexCloses(
  lastDate: Date,
  days: number,
  startClose: number,
  endClose: number
): IndexClose[] {
  const dayMs = 24 * 60 * 60 * 1000
  const step = days > 1 ? (endClose - startClose) / (days - 1) : 0

  return Array.from({ length: days }, (_, index) => ({
    date: new Date(lastDate.getTime() - (days - 1 - index) * dayMs),
    close: new Decimal(startClose + step * index),
  }))
}
