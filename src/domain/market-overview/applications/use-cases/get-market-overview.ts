import Decimal from 'decimal.js'
import { Either, right } from '@/core/either'
import { IndicatorValuesRepository } from '@/domain/market-data/applications/repositories/indicator-values-repository'
import { MarketSnapshotLoader } from '@/domain/market-data/applications/services/market-snapshot-loader'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'
import { IndicatorValue } from '@/domain/market-data/entities/indicator-value'
import {
  MarketScenario,
  REAL_RATE_FORMULA,
  REAL_RATE_HIGH_PERCENT,
  REAL_RATE_LOW_PERCENT,
  SCENARIO_NOTE,
  SELIC_HISTORY_MAX_GAP_DAYS,
  SELIC_TREND_MONTHS,
  SELIC_TREND_THRESHOLD_PP,
} from '@/domain/portfolio-analysis/services/market-scenario'
import { Alert } from '@/domain/shared/alert'
import { INCOME_TAX_BRACKETS } from '@/domain/shared/constants/income-tax'
import { AlertSeverity } from '@/domain/shared/enums/alert-severity'
import { ReadingTopic } from '../../entities/enums/reading-topic'
import {
  INDEX_MAX_AGE_DAYS,
  INDEX_MOVING_AVERAGE_DAYS,
  INDEX_RETURN_MAX_GAP_DAYS,
  INDEX_RETURN_MONTHS,
  IndexTrend,
} from '../../services/index-trend'
import { IndexContext, MarketReadings } from '../../services/market-readings'
import {
  DEFAULT_EXEMPT_PERCENT_OF_CDI,
  TaxExemptEquivalence,
} from '../../services/tax-exempt-equivalence'
import { MarketIndexCode } from '../dtos/market-index'
import {
  IndexReading,
  MarketOverview,
  RateValue,
} from '../dtos/market-overview'
import { MarketIndexProvider } from '../gateways/market-index-provider'

/** Meses exibidos no histórico (um ponto por mês). */
export const HISTORY_MONTHS = 12

/** Folga para cobrir 12 meses de Selic diária (úteis ou corridos). */
const SELIC_HISTORY_ROWS = 400

interface GetMarketOverviewUseCaseRequest {
  /** % do CDI de uma LCA/LCI para a equivalência. Padrão: 90. */
  exemptPercentOfCdi?: Decimal
}

/** Sempre `right`: dado ausente vira `null` + alerta, nunca erro. */
type GetMarketOverviewUseCaseResponse = Either<
  never,
  { overview: MarketOverview }
>

/**
 * "Mercado hoje": leitura do cenário de juros independente da carteira.
 * Calculada na hora a partir dos indicadores; não persiste nem usa LLM.
 */
export class GetMarketOverviewUseCase {
  private marketSnapshotLoader: MarketSnapshotLoader

  constructor(
    private indicatorValuesRepository: IndicatorValuesRepository,
    private marketIndexProvider: MarketIndexProvider,
    private now: () => Date = () => new Date()
  ) {
    this.marketSnapshotLoader = new MarketSnapshotLoader(
      indicatorValuesRepository
    )
  }

  async execute({
    exemptPercentOfCdi = DEFAULT_EXEMPT_PERCENT_OF_CDI,
  }: GetMarketOverviewUseCaseRequest = {}): Promise<GetMarketOverviewUseCaseResponse> {
    const now = this.now()

    const [market, selicRows, ipcaRows, ibovespa, ifix] = await Promise.all([
      this.marketSnapshotLoader.load(now),
      this.indicatorValuesRepository.findRecent(
        Indicator.SELIC,
        SELIC_HISTORY_ROWS
      ),
      this.indicatorValuesRepository.findRecent(Indicator.IPCA, HISTORY_MONTHS),
      this.readIndex(MarketIndexCode.IBOVESPA, 'Ibovespa', now),
      this.readIndex(MarketIndexCode.IFIX, 'IFIX', now),
    ])

    const selic = market.selic?.value ?? null
    const ipca12m = market.ipca12m
    const realRate = MarketScenario.realRate(selic, ipca12m)
    const trend = MarketScenario.trend(
      selic,
      market.selicSixMonthsAgo?.value ?? null
    )

    const ipcaAsOf = market.ipcaMonths[0]?.date ?? null

    const overview: MarketOverview = {
      generatedAt: now.toISOString(),
      rates: {
        selic: rate(market.selic?.value, market.selic?.date),
        cdi: rate(market.cdi?.value, market.cdi?.date),
        ipca12m: rate(ipca12m ?? undefined, ipcaAsOf ?? undefined),
        realRate: realRate ? { value: realRate.toFixed(2) } : null,
        selicTrend: trend,
      },
      history: {
        selic: lastValuePerMonth(selicRows).map((row) => ({
          date: isoDate(row.date),
          value: row.value.toFixed(2),
        })),
        ipcaMonthly: [...ipcaRows].reverse().map((row) => ({
          month: isoDate(row.date).slice(0, 7),
          value: row.value.toFixed(2),
        })),
      },
      readings: MarketReadings.build({
        selic,
        ipca12m,
        realRate,
        trend,
        indices: {
          [ReadingTopic.STOCKS]: ibovespa.context,
          [ReadingTopic.REAL_ESTATE_FUNDS]: ifix.context,
        },
      }),
      // Sem CDI não há o que comparar: lista vazia + alerta.
      equivalences: market.cdi
        ? [TaxExemptEquivalence.compute(exemptPercentOfCdi)]
        : [],
      market: {
        ibovespa: ibovespa.context.reading,
        ifix: ifix.context.reading,
      },
      alerts: alerts({
        hasSelic: market.selic !== null,
        hasCdi: market.cdi !== null,
        hasIpca12m: ipca12m !== null,
        hasTrend: trend !== null,
        indexIssues: [ibovespa, ifix].flatMap((index) =>
          index.context.reading
            ? []
            : [
                {
                  name: index.context.name,
                  detail: index.context.unavailableDetail ?? '',
                },
              ]
        ),
      }),
      assumptions: {
        generatedAt: now.toISOString(),
        indicators: market.sources,
        realRateFormula: REAL_RATE_FORMULA,
        ipca12mFormula: 'IPCA acumulado dos últimos 12 meses (composto)',
        realRateHighPercent: REAL_RATE_HIGH_PERCENT.toString(),
        realRateLowPercent: REAL_RATE_LOW_PERCENT.toString(),
        selicTrend: {
          months: SELIC_TREND_MONTHS,
          thresholdPp: SELIC_TREND_THRESHOLD_PP.toString(),
          historyMaxGapDays: SELIC_HISTORY_MAX_GAP_DAYS,
        },
        readingRules:
          'Regra do produto (não é norma): FIXED_POST favorecido com juro real alto e Selic fora de queda, ' +
          'ou Selic em alta; menos favorecido com juro real baixo, ou Selic em queda com juro real abaixo do alto. ' +
          'FIXED_INFLATION: favorecido com juro real alto, menos favorecido com juro real baixo. ' +
          'FIXED_PRE: favorecido com Selic em queda e juro real ≥ limiar baixo, menos favorecido com Selic em alta. ' +
          'TAX_EXEMPT segue FIXED_POST. STOCKS e REAL_ESTATE_FUNDS seguem o viés do cenário de juros ' +
          '(juro real baixo ou Selic em queda favorece; juro real alto pesa contra). ' +
          'Quando as duas pontas disparam, LESS_FAVORED vence.',
        scenarioNote: SCENARIO_NOTE,
        equivalence: {
          formula: 'equivalente = isento / (1 − IR)',
          exemptPercentOfCdi: exemptPercentOfCdi.toFixed(2),
          defaultExemptPercentOfCdi: DEFAULT_EXEMPT_PERCENT_OF_CDI.toFixed(2),
          incomeTaxSource: 'Lei 11.033/2004, art. 1º (IR regressivo)',
          incomeTaxBrackets: INCOME_TAX_BRACKETS.map((bracket) => ({
            upToDays: Number.isFinite(bracket.upToDays)
              ? bracket.upToDays
              : null,
            rate: bracket.rate.toString(),
          })),
        },
        indices: {
          trendRule:
            'UP: preço acima da média de 200 dias e retorno em 12 meses > 0; DOWN: abaixo da média e retorno < 0; ' +
            'MIXED: qualquer outro caso. Descritiva, não preditiva; é contexto e não muda a leitura dos juros.',
          movingAverageDays: INDEX_MOVING_AVERAGE_DAYS,
          returnMonths: INDEX_RETURN_MONTHS,
          maxQuoteAgeDays: INDEX_MAX_AGE_DAYS,
          returnReferenceMaxGapDays: INDEX_RETURN_MAX_GAP_DAYS,
          sources: {
            IBOVESPA: ibovespa.source,
            IFIX: ifix.source,
          },
          unavailableIsNeverSubstituted:
            'Índice indisponível vem null + INDEX_UNAVAILABLE; não se usa ETF ou outro índice no lugar.',
        },
      },
    }

    return right({ overview })
  }

  /** Nunca lança: fonte fora do ar ou histórico curto vira contexto "indisponível". */
  private async readIndex(
    code: MarketIndexCode,
    name: string,
    now: Date
  ): Promise<{ context: IndexContext; source: string | null }> {
    const history = await this.marketIndexProvider.getHistory(code)

    if (history.isLeft()) {
      return {
        source: null,
        context: {
          name,
          reading: null,
          unavailableDetail: 'a fonte de dados está indisponível',
        },
      }
    }

    const result = IndexTrend.compute(history.value, now)

    if (!result.available) {
      return {
        source: history.value.source,
        context: { name, reading: null, unavailableDetail: result.detail },
      }
    }

    const { reading } = result

    return {
      source: reading.source,
      context: {
        name,
        reading: {
          asOf: isoDate(reading.asOf),
          source: reading.source,
          return12m: reading.return12m.toFixed(2),
          vsMovingAverage200: reading.vsMovingAverage200.toFixed(2),
          trend: reading.trend,
        } satisfies IndexReading,
      },
    }
  }
}

function rate(value?: Decimal, asOf?: Date): RateValue | null {
  return value && asOf ? { value: value.toFixed(2), asOf: isoDate(asOf) } : null
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

/**
 * Último valor de cada mês, dos últimos `HISTORY_MONTHS` meses, do mais
 * antigo ao mais novo. `rows` vem do mais novo para o mais antigo.
 */
function lastValuePerMonth(rows: IndicatorValue[]) {
  const latestOfMonth = new Map<string, IndicatorValue>()

  for (const row of rows) {
    const month = isoDate(row.date).slice(0, 7)

    if (!latestOfMonth.has(month)) latestOfMonth.set(month, row)
  }

  return [...latestOfMonth.values()].slice(0, HISTORY_MONTHS).reverse()
}

function alerts({
  hasSelic,
  hasCdi,
  hasIpca12m,
  hasTrend,
  indexIssues,
}: {
  hasSelic: boolean
  hasCdi: boolean
  hasIpca12m: boolean
  hasTrend: boolean
  indexIssues: { name: string; detail: string }[]
}): Alert[] {
  const result: Alert[] = []
  const missing = [
    !hasSelic && 'Selic',
    !hasCdi && 'CDI',
    !hasIpca12m && 'IPCA (12 meses)',
  ].filter(Boolean)

  if (missing.length > 0) {
    result.push({
      code: 'MARKET_DATA_UNAVAILABLE',
      severity: AlertSeverity.INFO,
      message: `Sem dado recente de ${missing.join(', ')}: as leituras que dependem dele ficam indisponíveis ou neutras.`,
    })
  }

  if (hasSelic && !hasTrend) {
    result.push({
      code: 'SELIC_HISTORY_UNAVAILABLE',
      severity: AlertSeverity.INFO,
      message:
        'Sem histórico da Selic de ~6 meses atrás: a tendência dos juros não foi calculada e as regras que dependem dela não disparam.',
    })
  }

  for (const issue of indexIssues) {
    result.push({
      code: 'INDEX_UNAVAILABLE',
      severity: AlertSeverity.INFO,
      message: `Sem tendência do ${issue.name}: ${issue.detail}.`,
    })
  }

  // Só quando nenhum índice chegou: a leitura vem exclusivamente dos juros.
  if (indexIssues.length === 2) {
    result.push({
      code: 'NO_EQUITY_MARKET_DATA',
      severity: AlertSeverity.INFO,
      message:
        'Sem dados de preço de bolsa e de fundos imobiliários: a leitura de ações e FIIs vem só do cenário de juros.',
    })
  }

  return result
}
