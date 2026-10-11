import Decimal from 'decimal.js'
import {
  DAILY_INDICATOR_MAX_AGE_DAYS,
  IPCA_MAX_AGE_DAYS,
} from '@/domain/comparison/applications/use-cases/evaluate-comparison'
import { RateNormalizer } from '@/domain/comparison/services/rate-normalizer'
import {
  SELIC_HISTORY_MAX_GAP_DAYS,
  SELIC_TREND_MONTHS,
} from '@/domain/portfolio-analysis/services/market-scenario'
import { addUtcMonths, daysBetween, startOfUtcDay } from '@/domain/shared/dates'
import { Indicator } from '../../entities/enums/indicator'
import { IndicatorValue } from '../../entities/indicator-value'
import { IndicatorValuesRepository } from '../repositories/indicator-values-repository'

/** Meses de IPCA mensal que compõem o acumulado de 12 meses. */
export const IPCA_MONTHS = 12

export interface MarketSnapshot {
  /** Já filtrados por frescor: `null` = indisponível (job parado). */
  selic: IndicatorValue | null
  cdi: IndicatorValue | null
  /** Selic de ~6 meses atrás; `null` = sem histórico próximo da data-alvo. */
  selicSixMonthsAgo: IndicatorValue | null
  /** IPCA acumulado em 12 meses (%); `null` sem 12 meses seguidos e recentes. */
  ipca12m: Decimal | null
  /** Os 12 meses que compõem `ipca12m`, do mais novo ao mais antigo (vazio se `null`). */
  ipcaMonths: IndicatorValue[]
  /** Fonte e data de cada leitura, no formato gravado em `assumptions`. */
  sources: Record<string, unknown>
}

/**
 * Lê os indicadores de juros do banco e aplica as regras de frescor e
 * continuidade, num lugar só (carteira e "mercado hoje" usam o mesmo
 * resultado). Nunca falha: dado ausente ou velho vira `null`.
 */
export class MarketSnapshotLoader {
  constructor(private indicatorValuesRepository: IndicatorValuesRepository) {}

  async load(now: Date): Promise<MarketSnapshot> {
    const [selic, cdi, ipcaRecent] = await Promise.all([
      this.indicatorValuesRepository.findLatest(Indicator.SELIC),
      this.indicatorValuesRepository.findLatest(Indicator.CDI),
      this.indicatorValuesRepository.findRecent(Indicator.IPCA, IPCA_MONTHS),
    ])

    const freshSelic = isFresh(selic, now, DAILY_INDICATOR_MAX_AGE_DAYS)
      ? selic
      : null
    const freshCdi = isFresh(cdi, now, DAILY_INDICATOR_MAX_AGE_DAYS)
      ? cdi
      : null

    // Selic de ~6 meses atrás, para a tendência. Sem histórico = sem tendência.
    let pastSelic: IndicatorValue | null = null

    if (freshSelic) {
      const target = startOfUtcDay(addUtcMonths(now, -SELIC_TREND_MONTHS))
      const found = await this.indicatorValuesRepository.findOnOrBefore(
        Indicator.SELIC,
        target
      )

      if (
        found &&
        daysBetween(found.date, target) <= SELIC_HISTORY_MAX_GAP_DAYS
      ) {
        pastSelic = found
      }
    }

    // IPCA 12m só com 12 meses seguidos e o último não muito velho.
    const hasIpca12m =
      ipcaRecent.length === IPCA_MONTHS &&
      isFresh(ipcaRecent[0], now, IPCA_MAX_AGE_DAYS) &&
      areConsecutiveMonths(ipcaRecent)

    const ipca12m = hasIpca12m
      ? RateNormalizer.accumulate(ipcaRecent.map((month) => month.value))
      : null

    return {
      selic: freshSelic,
      cdi: freshCdi,
      selicSixMonthsAgo: pastSelic,
      ipca12m,
      ipcaMonths: hasIpca12m ? ipcaRecent : [],
      sources: {
        SELIC: describe(freshSelic),
        CDI: describe(freshCdi),
        SELIC_6M_AGO: describe(pastSelic),
        IPCA_12M:
          hasIpca12m && ipca12m
            ? {
                value: ipca12m.toDecimalPlaces(6).toString(),
                from: isoDate(ipcaRecent[ipcaRecent.length - 1].date),
                to: isoDate(ipcaRecent[0].date),
                source: ipcaRecent[0].source,
              }
            : null,
      },
    }
  }
}

function isFresh(
  value: IndicatorValue | null | undefined,
  now: Date,
  maxAgeDays: number
): value is IndicatorValue {
  return !!value && daysBetween(value.date, now) <= maxAgeDays
}

/** `months` vem do mais novo para o mais antigo. */
function areConsecutiveMonths(months: IndicatorValue[]) {
  const index = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth()

  return months.every(
    (month, position) =>
      position === 0 ||
      index(months[position - 1].date) - index(month.date) === 1
  )
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function describe(value: IndicatorValue | null) {
  return value
    ? {
        value: value.value.toString(),
        date: isoDate(value.date),
        source: value.source,
      }
    : null
}
