import { Either } from '@/core/either'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import { StockSnapshot } from '../dtos/stock-snapshot'
import { TickerNotFoundError } from '../errors/ticker-not-found-error'

/**
 * Fonte externa de dados de ações (adapter real: brapi.dev).
 * Falha de rede/fonte vira `left(MarketDataUnavailableError)`, ticker
 * inexistente vira `left(TickerNotFoundError)` — nunca `throw`.
 */
export abstract class StockDataProvider {
  abstract getSnapshot(
    ticker: string
  ): Promise<
    Either<MarketDataUnavailableError | TickerNotFoundError, StockSnapshot>
  >
}
