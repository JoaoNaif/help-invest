import { Either, left, right } from '@/core/either'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import {
  IndicatorDataPoint,
  IndicatorSeries,
  MarketDataProvider,
} from '@/domain/market-data/applications/gateways/market-data-provider'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'

/**
 * Série fixa por indicador. `failing` simula a fonte fora do ar.
 * `calls` registra cada consulta, para os testes conferirem o período pedido.
 */
export class FakeMarketDataProvider implements MarketDataProvider {
  public series = new Map<Indicator, IndicatorDataPoint[]>()
  public failing = new Set<Indicator>()
  public calls: { indicator: Indicator; from: Date; to: Date }[] = []

  async fetchSeries(
    indicator: Indicator,
    from: Date,
    to: Date
  ): Promise<Either<MarketDataUnavailableError, IndicatorSeries>> {
    this.calls.push({ indicator, from, to })

    if (this.failing.has(indicator)) {
      return left(new MarketDataUnavailableError('Fake BCB'))
    }

    const points = (this.series.get(indicator) ?? []).filter(
      (point) =>
        point.date.getTime() >= from.getTime() &&
        point.date.getTime() <= to.getTime()
    )

    return right({ source: `Fake BCB ${indicator}`, points })
  }
}
