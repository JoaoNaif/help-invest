import Decimal from 'decimal.js'
import { z } from 'zod'
import { Either, left, right } from '@/core/either'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import {
  IndicatorSeries,
  MarketDataProvider,
} from '@/domain/market-data/applications/gateways/market-data-provider'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'

const BCB_SGS_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs'

/** Código da série no SGS do Banco Central. Unidades: ver `Indicator`. */
const SGS_CODES: Record<Indicator, number> = {
  SELIC: 432,
  CDI: 4389,
  IPCA: 433,
}

const REQUEST_TIMEOUT_MS = 15_000

// O SGS devolve data como "dd/MM/yyyy" e valor como string ("13.90").
const sgsResponseSchema = z.array(
  z.object({
    data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
    valor: z.string().regex(/^-?\d+(\.\d+)?$/),
  })
)

type FetchLike = typeof fetch

/**
 * Adapter do `MarketDataProvider` na API pública SGS do Banco Central
 * (sem chave nem cadastro). Qualquer falha — rede, timeout, HTTP != 200 ou
 * corpo fora do formato — vira `left(MarketDataUnavailableError)`: nunca
 * gravamos dado de mercado que não conseguimos validar.
 *
 * Limite conhecido do SGS: séries diárias aceitam no máximo 10 anos por
 * consulta. A primeira sincronização pede 5 (`INITIAL_SYNC_YEARS`).
 */
export class BcbMarketDataProvider implements MarketDataProvider {
  constructor(private fetchFn: FetchLike = fetch) {}

  async fetchSeries(
    indicator: Indicator,
    from: Date,
    to: Date
  ): Promise<Either<MarketDataUnavailableError, IndicatorSeries>> {
    const code = SGS_CODES[indicator]
    const source = `BCB SGS ${code}`

    const url =
      `${BCB_SGS_URL}.${code}/dados?formato=json` +
      `&dataInicial=${formatBcbDate(from)}&dataFinal=${formatBcbDate(to)}`

    try {
      const response = await this.fetchFn(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (!response.ok) {
        return left(new MarketDataUnavailableError(source))
      }

      const parsed = sgsResponseSchema.safeParse(await response.json())

      if (!parsed.success) {
        return left(new MarketDataUnavailableError(source))
      }

      return right({
        source,
        points: parsed.data.map((point) => ({
          date: parseBcbDate(point.data),
          value: new Decimal(point.valor),
        })),
      })
    } catch {
      // rede, timeout (AbortError) ou corpo que não é JSON
      return left(new MarketDataUnavailableError(source))
    }
  }
}

function formatBcbDate(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')

  return `${day}/${month}/${date.getUTCFullYear()}`
}

function parseBcbDate(value: string) {
  const [day, month, year] = value.split('/').map(Number)

  return new Date(Date.UTC(year, month - 1, day))
}
