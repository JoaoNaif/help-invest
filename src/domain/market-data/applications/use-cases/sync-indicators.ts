import { Either, right } from '@/core/either'
import { Indicator } from '../../entities/enums/indicator'
import { IndicatorValue } from '../../entities/indicator-value'
import { MarketDataUnavailableError } from '../errors/market-data-unavailable-error'
import { MarketDataProvider } from '../gateways/market-data-provider'
import { IndicatorValuesRepository } from '../repositories/indicator-values-repository'

/** Na primeira sincronização, quantos anos de histórico buscar. */
export const INITIAL_SYNC_YEARS = 5

interface SyncIndicatorsUseCaseRequest {
  /** Padrão: todos. */
  indicators?: Indicator[]
  /** Padrão: hoje. */
  until?: Date
}

interface SyncedIndicator {
  indicator: Indicator
  inserted: number
}

interface FailedIndicator {
  indicator: Indicator
  error: MarketDataUnavailableError
}

/**
 * Sempre `right`: a falha de um indicador não impede os outros de serem
 * gravados. Quem chama (cron) registra os `failed` e tenta no próximo ciclo.
 */
type SyncIndicatorsUseCaseResponse = Either<
  never,
  { synced: SyncedIndicator[]; failed: FailedIndicator[] }
>

/**
 * UC-13 — ver docs/08-casos-de-uso.md#uc-13--syncindicators
 * Job agendado, sem usuário. Busca só o que vem depois da última data gravada.
 */
export class SyncIndicatorsUseCase {
  constructor(
    private indicatorValuesRepository: IndicatorValuesRepository,
    private marketDataProvider: MarketDataProvider
  ) {}

  async execute({
    indicators = Object.values(Indicator),
    until = new Date(),
  }: SyncIndicatorsUseCaseRequest = {}): Promise<SyncIndicatorsUseCaseResponse> {
    const to = startOfUtcDay(until)
    const synced: SyncedIndicator[] = []
    const failed: FailedIndicator[] = []

    for (const indicator of indicators) {
      const latest = await this.indicatorValuesRepository.findLatest(indicator)

      const from = latest
        ? addUtcDays(latest.date, 1)
        : addUtcYears(to, -INITIAL_SYNC_YEARS)

      // Já está em dia: nem consulta a fonte.
      if (from.getTime() > to.getTime()) {
        synced.push({ indicator, inserted: 0 })
        continue
      }

      const result = await this.marketDataProvider.fetchSeries(
        indicator,
        from,
        to
      )

      if (result.isLeft()) {
        failed.push({ indicator, error: result.value })
        continue
      }

      const { source, points } = result.value

      const values = points.map((point) =>
        IndicatorValue.create({
          indicator,
          date: startOfUtcDay(point.date),
          value: point.value,
          source,
        })
      )

      const inserted = await this.indicatorValuesRepository.createMany(values)

      synced.push({ indicator, inserted })
    }

    return right({ synced, failed })
  }
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

function addUtcDays(date: Date, days: number) {
  const result = startOfUtcDay(date)
  result.setUTCDate(result.getUTCDate() + days)

  return result
}

function addUtcYears(date: Date, years: number) {
  const result = startOfUtcDay(date)
  result.setUTCFullYear(result.getUTCFullYear() + years)

  return result
}
