import Decimal from 'decimal.js'
import { z } from 'zod'
import { Either, left, right } from '@/core/either'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import {
  IndexClose,
  IndexHistory,
  MarketIndexCode,
} from '@/domain/market-overview/applications/dtos/market-index'
import { MarketIndexProvider } from '@/domain/market-overview/applications/gateways/market-index-provider'
import { startOfUtcDay } from '@/domain/shared/dates'
import {
  YAHOO_CHART_URL,
  YAHOO_REQUEST_TIMEOUT_MS,
  YAHOO_SOURCE,
  YAHOO_USER_AGENT,
} from './yahoo-finance'

/**
 * Símbolos conferidos no Yahoo em 2026-10-11:
 * - `^BVSP` (Ibovespa): INDEX, ~500 fechamentos em 2 anos, serve.
 * - `IFIX.SA`: existe como INDEX ("IND FDO IMOB"), mas o Yahoo só expõe os
 *   ranges `1d` e `5d` — **um** fechamento, sem histórico. Não dá para média
 *   de 200 dias nem retorno de 12 meses, então o domínio o trata como
 *   indisponível. Substitutos (ETF `XFIX11`) **não** são usados: não são o
 *   índice. Se o Yahoo passar a servir o histórico, nada muda aqui.
 */
const SYMBOLS: Record<MarketIndexCode, string> = {
  [MarketIndexCode.IBOVESPA]: '^BVSP',
  [MarketIndexCode.IFIX]: 'IFIX.SA',
}

/** 2 anos de pregões bastam para média de 200 dias + retorno de 12 meses. */
const RANGE = '2y'

/** Sucesso: 1 h. O Yahoo não é oficial e o índice não muda a cada request. */
export const SUCCESS_TTL_MS = 60 * 60 * 1000

/** Falha: 5 min, para não bater na fonte a cada request quando ela cai. */
export const FAILURE_TTL_MS = 5 * 60 * 1000

type FetchLike = typeof fetch

const chartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          timestamp: z.array(z.number()).optional(),
          indicators: z.object({
            quote: z
              .array(
                z.object({ close: z.array(z.number().nullable()).optional() })
              )
              .min(1),
          }),
        })
      )
      .min(1),
  }),
})

interface CacheEntry {
  expiresAt: number
  result: Either<MarketDataUnavailableError, IndexHistory>
}

/**
 * Adapter do `MarketIndexProvider` no Yahoo Finance (não oficial, sem chave):
 * `v8/finance/chart` com `interval=1d`, que não exige cookie nem crumb.
 *
 * Qualquer falha — rede, timeout, 401/429/HTTP inesperado ou corpo fora do
 * formato — vira `left(MarketDataUnavailableError)`. Dias sem fechamento
 * (`null`) são descartados, nunca viram zero. Cache em memória (1 h; falha
 * 5 min), por índice.
 */
export class YahooMarketIndexProvider implements MarketIndexProvider {
  private cache = new Map<MarketIndexCode, CacheEntry>()

  constructor(
    private fetchFn: FetchLike = fetch,
    private now: () => Date = () => new Date()
  ) {}

  async getHistory(
    code: MarketIndexCode
  ): Promise<Either<MarketDataUnavailableError, IndexHistory>> {
    const nowMs = this.now().getTime()
    const cached = this.cache.get(code)

    if (cached && cached.expiresAt > nowMs) return cached.result

    const result = await this.fetchHistory(code)

    this.cache.set(code, {
      expiresAt: nowMs + (result.isRight() ? SUCCESS_TTL_MS : FAILURE_TTL_MS),
      result,
    })

    return result
  }

  private async fetchHistory(
    code: MarketIndexCode
  ): Promise<Either<MarketDataUnavailableError, IndexHistory>> {
    const symbol = SYMBOLS[code]
    const unavailable = (): Either<MarketDataUnavailableError, IndexHistory> =>
      left(new MarketDataUnavailableError(`${YAHOO_SOURCE} (${symbol})`))

    try {
      const response = await this.fetchFn(
        `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=${RANGE}&interval=1d`,
        {
          headers: { 'User-Agent': YAHOO_USER_AGENT },
          signal: AbortSignal.timeout(YAHOO_REQUEST_TIMEOUT_MS),
        }
      )

      if (!response.ok) return unavailable()

      const parsed = chartSchema.safeParse(await response.json())

      if (!parsed.success) return unavailable()

      const [result] = parsed.data.chart.result
      const timestamps = result.timestamp ?? []
      const rawCloses = result.indicators.quote[0].close ?? []

      const closes: IndexClose[] = []

      timestamps.forEach((timestamp, index) => {
        const close = rawCloses[index]

        if (close === null || close === undefined) return

        closes.push({
          date: startOfUtcDay(new Date(timestamp * 1000)),
          close: new Decimal(close),
        })
      })

      if (closes.length === 0) return unavailable()

      return right({
        code,
        source: `${YAHOO_SOURCE} (${symbol})`,
        closes,
      })
    } catch {
      // Rede, timeout ou JSON inválido: a fonte conta como indisponível.
      return unavailable()
    }
  }
}
