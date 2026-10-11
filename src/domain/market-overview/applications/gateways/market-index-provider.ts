import { Either } from '@/core/either'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import { IndexHistory, MarketIndexCode } from '../dtos/market-index'

/**
 * Fonte externa de índices (adapter real: Yahoo Finance, não oficial).
 * Falha de rede/fonte vira `left(MarketDataUnavailableError)` — nunca `throw`.
 * Não inventa substituto: se a fonte não expõe o índice, o domínio recebe o
 * pouco que houver (ou o `left`) e o campo vira `null` + alerta.
 */
export abstract class MarketIndexProvider {
  abstract getHistory(
    code: MarketIndexCode
  ): Promise<Either<MarketDataUnavailableError, IndexHistory>>
}
