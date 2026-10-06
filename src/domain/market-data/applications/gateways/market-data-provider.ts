import Decimal from 'decimal.js'
import { Either } from '@/core/either'
import { Indicator } from '../../entities/enums/indicator'
import { MarketDataUnavailableError } from '../errors/market-data-unavailable-error'

export interface IndicatorDataPoint {
  /** Data de referência, meia-noite UTC. */
  date: Date
  value: Decimal
}

export interface IndicatorSeries {
  /** Ex.: "BCB SGS 4389" — gravado junto com cada valor. */
  source: string
  points: IndicatorDataPoint[]
}

/**
 * Fonte externa de índices (adapter real: API SGS do BCB).
 * Falha de rede/fonte vira `left(MarketDataUnavailableError)`, nunca `throw`.
 */
export abstract class MarketDataProvider {
  /** Valores com data entre `from` e `to`, inclusive. */
  abstract fetchSeries(
    indicator: Indicator,
    from: Date,
    to: Date
  ): Promise<Either<MarketDataUnavailableError, IndicatorSeries>>
}
