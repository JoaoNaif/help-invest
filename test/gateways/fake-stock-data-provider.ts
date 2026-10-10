import { Either, left, right } from '@/core/either'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import { StockSnapshot } from '@/domain/stock-analysis/applications/dtos/stock-snapshot'
import { TickerNotFoundError } from '@/domain/stock-analysis/applications/errors/ticker-not-found-error'
import { StockDataProvider } from '@/domain/stock-analysis/applications/gateways/stock-data-provider'

/**
 * Snapshots fixos por ticker. Ticker ausente em `snapshots` vira
 * `TickerNotFoundError`; `failing` simula a fonte fora do ar.
 * `calls` registra os tickers consultados.
 */
export class FakeStockDataProvider implements StockDataProvider {
  public snapshots = new Map<string, StockSnapshot>()
  public failing = new Set<string>()
  public calls: string[] = []

  async getSnapshot(
    ticker: string
  ): Promise<
    Either<MarketDataUnavailableError | TickerNotFoundError, StockSnapshot>
  > {
    this.calls.push(ticker)

    if (this.failing.has(ticker)) {
      return left(new MarketDataUnavailableError('Fake brapi'))
    }

    const snapshot = this.snapshots.get(ticker)

    if (!snapshot) return left(new TickerNotFoundError(ticker))

    return right(snapshot)
  }
}
