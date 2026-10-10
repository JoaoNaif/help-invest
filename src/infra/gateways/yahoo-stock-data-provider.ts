import Decimal from 'decimal.js'
import { z } from 'zod'
import { Either, left, right } from '@/core/either'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import {
  AnalystConsensus,
  DividendKind,
  DividendPayment,
  StockFundamentals,
  StockSnapshot,
} from '@/domain/stock-analysis/applications/dtos/stock-snapshot'
import { TickerNotFoundError } from '@/domain/stock-analysis/applications/errors/ticker-not-found-error'
import { StockDataProvider } from '@/domain/stock-analysis/applications/gateways/stock-data-provider'

const SOURCE = 'Yahoo Finance'
const COOKIE_URL = 'https://fc.yahoo.com'
const CRUMB_URL = 'https://query1.finance.yahoo.com/v1/test/getcrumb'
const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'
const SUMMARY_URL = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary'
const SUMMARY_MODULES = [
  'defaultKeyStatistics',
  'financialData',
  'summaryDetail',
  'recommendationTrend',
  'assetProfile',
].join(',')

/** O Yahoo recusa requisições sem User-Agent de navegador. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const REQUEST_TIMEOUT_MS = 15_000
const DIVIDEND_HISTORY_YEARS = 10

/** Ticker da B3: 4 letras + 1 ou 2 dígitos (PETR4, BBDC4, SANB11). */
const B3_TICKER = /^[A-Z]{4}\d{1,2}$/

type FetchLike = typeof fetch

const rawNumber = z.object({ raw: z.number().optional() }).optional()

const chartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            regularMarketPrice: z.number(),
            regularMarketTime: z.number(),
            longName: z.string().optional(),
            shortName: z.string().optional(),
            firstTradeDate: z.number().nullable().optional(),
          }),
          events: z
            .object({
              dividends: z
                .record(z.object({ amount: z.number(), date: z.number() }))
                .optional(),
            })
            .optional(),
        })
      )
      .min(1),
  }),
})

const summarySchema = z.object({
  quoteSummary: z.object({
    result: z
      .array(
        z.object({
          defaultKeyStatistics: z
            .object({
              priceToBook: rawNumber,
              bookValue: rawNumber,
              trailingEps: rawNumber,
            })
            .optional(),
          financialData: z
            .object({ returnOnEquity: rawNumber, targetMeanPrice: rawNumber })
            .optional(),
          summaryDetail: z.object({ trailingPE: rawNumber }).optional(),
          recommendationTrend: z
            .object({
              trend: z.array(
                z.object({
                  period: z.string(),
                  strongBuy: z.number(),
                  buy: z.number(),
                  hold: z.number(),
                  sell: z.number(),
                  strongSell: z.number(),
                })
              ),
            })
            .optional(),
          assetProfile: z.object({ sector: z.string().optional() }).optional(),
        })
      )
      .min(1),
  }),
})

type Summary = z.infer<typeof summarySchema>['quoteSummary']['result'][number]

interface Session {
  cookie: string
  crumb: string
}

/** Resposta que não dá para usar; o `getSnapshot` a converte em `left`. */
class SourceUnavailable extends Error {}
class SourceTickerNotFound extends Error {}

/**
 * Adapter do `StockDataProvider` no Yahoo Finance (não oficial, sem chave).
 *
 * - Preço, nome e proventos: `v8/finance/chart` (sem autenticação). Precisa de
 *   `interval=1d`: com `1mo` o Yahoo descarta proventos (ITUB4 perdia 2025 e
 *   parte de 2024), e o yield sai errado sem nenhum erro.
 * - Fundamentos, setor e consenso: `v10/finance/quoteSummary`, que exige
 *   cookie + crumb. A sessão fica em memória e é renovada uma vez em 401/403.
 * - O `dividendYield` do Yahoo é ignorado de propósito: já vimos valor
 *   incompatível com os proventos (BBAS3: 0,57%). O yield é calculado pelo
 *   `DividendAnalyzer` a partir dos proventos.
 * - A data dos proventos é a **ex**; o Yahoo não separa JCP de dividendo.
 *
 * Qualquer falha — rede, timeout, HTTP inesperado ou corpo fora do formato —
 * vira `left(MarketDataUnavailableError)`; ticker inexistente vira
 * `left(TickerNotFoundError)`. Campo ausente vira `null`, nunca zero.
 */
export class YahooStockDataProvider implements StockDataProvider {
  private session: Session | null = null

  constructor(
    private fetchFn: FetchLike = fetch,
    private now: () => Date = () => new Date()
  ) {}

  async getSnapshot(
    rawTicker: string
  ): Promise<
    Either<MarketDataUnavailableError | TickerNotFoundError, StockSnapshot>
  > {
    const ticker = rawTicker.trim().toUpperCase()

    // Também impede que um texto qualquer vire parte da URL.
    if (!B3_TICKER.test(ticker)) return left(new TickerNotFoundError(ticker))

    const symbol = `${ticker}.SA`

    try {
      const chart = await this.fetchChart(symbol)
      const summary = await this.fetchSummary(symbol)

      return right(this.toSnapshot(ticker, chart, summary))
    } catch (error) {
      if (error instanceof SourceTickerNotFound) {
        return left(new TickerNotFoundError(ticker))
      }

      return left(new MarketDataUnavailableError(SOURCE))
    }
  }

  private async fetchChart(symbol: string) {
    const url =
      `${CHART_URL}/${symbol}?range=${DIVIDEND_HISTORY_YEARS}y` +
      '&interval=1d&events=div'

    const response = await this.request(url)

    if (response.status === 404) throw new SourceTickerNotFound()
    if (!response.ok) throw new SourceUnavailable()

    const parsed = chartSchema.safeParse(await response.json())

    if (!parsed.success) throw new SourceUnavailable()

    return parsed.data.chart.result[0]
  }

  private async fetchSummary(symbol: string): Promise<Summary> {
    for (const attempt of [1, 2]) {
      const session = await this.getSession()
      const url =
        `${SUMMARY_URL}/${symbol}?modules=${SUMMARY_MODULES}` +
        `&crumb=${encodeURIComponent(session.crumb)}`

      const response = await this.request(url, session.cookie)

      if (response.status === 404) throw new SourceTickerNotFound()

      // Crumb vencido: renova a sessão e tenta uma única vez de novo.
      if (response.status === 401 || response.status === 403) {
        this.session = null
        if (attempt === 1) continue
      }

      if (!response.ok) throw new SourceUnavailable()

      const parsed = summarySchema.safeParse(await response.json())

      if (!parsed.success) throw new SourceUnavailable()

      return parsed.data.quoteSummary.result[0]
    }

    throw new SourceUnavailable()
  }

  private async getSession(): Promise<Session> {
    if (this.session) return this.session

    const cookieResponse = await this.request(COOKIE_URL)
    // fc.yahoo.com responde 404, mas grava o cookie — só ele importa.
    const cookie = cookieResponse.headers
      .getSetCookie()
      .map((entry) => entry.split(';')[0])
      .join('; ')

    if (!cookie) throw new SourceUnavailable()

    const crumbResponse = await this.request(CRUMB_URL, cookie)
    const crumb = (await crumbResponse.text()).trim()

    // Em falha o Yahoo devolve HTML ou JSON de erro no lugar do crumb.
    if (!crumbResponse.ok || !/^[\w./-]{3,40}$/.test(crumb)) {
      throw new SourceUnavailable()
    }

    this.session = { cookie, crumb }

    return this.session
  }

  private request(url: string, cookie?: string) {
    return this.fetchFn(url, {
      headers: {
        'User-Agent': USER_AGENT,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  }

  private toSnapshot(
    ticker: string,
    chart: z.infer<typeof chartSchema>['chart']['result'][number],
    summary: Summary
  ): StockSnapshot {
    const now = this.now()
    const historyStart = new Date(now)
    historyStart.setUTCFullYear(
      historyStart.getUTCFullYear() - DIVIDEND_HISTORY_YEARS
    )
    const firstTrade = chart.meta.firstTradeDate
      ? new Date(chart.meta.firstTradeDate * 1000)
      : null

    return {
      ticker,
      name: chart.meta.longName ?? chart.meta.shortName ?? ticker,
      sector: summary.assetProfile?.sector ?? null,
      price: new Decimal(chart.meta.regularMarketPrice),
      priceDate: new Date(chart.meta.regularMarketTime * 1000),
      fundamentals: toFundamentals(summary),
      dividends: toDividends(chart.events?.dividends ?? {}),
      // O histórico só vai até a estreia da ação ou até o limite pedido.
      dividendsHistoryFrom:
        firstTrade && firstTrade.getTime() > historyStart.getTime()
          ? firstTrade
          : historyStart,
      consensus: toConsensus(summary),
      source: SOURCE,
    }
  }
}

function decimalOrNull(value: { raw?: number } | undefined) {
  return value?.raw === undefined || !Number.isFinite(value.raw)
    ? null
    : new Decimal(value.raw)
}

function toFundamentals(summary: Summary): StockFundamentals {
  const roe = decimalOrNull(summary.financialData?.returnOnEquity)

  return {
    priceToEarnings: decimalOrNull(summary.summaryDetail?.trailingPE),
    priceToBook: decimalOrNull(summary.defaultKeyStatistics?.priceToBook),
    earningsPerShare: decimalOrNull(summary.defaultKeyStatistics?.trailingEps),
    bookValuePerShare: decimalOrNull(summary.defaultKeyStatistics?.bookValue),
    // O Yahoo manda fração (0,105); o domínio trabalha em % (10,5).
    returnOnEquity: roe ? roe.times(100) : null,
  }
}

function toDividends(
  events: Record<string, { amount: number; date: number }>
): DividendPayment[] {
  return Object.values(events)
    .map((event) => ({
      exDate: new Date(event.date * 1000),
      paymentDate: null,
      amountPerShare: new Decimal(event.amount),
      kind: DividendKind.OTHER,
    }))
    .sort((a, b) => a.exDate.getTime() - b.exDate.getTime())
}

function toConsensus(summary: Summary): AnalystConsensus | null {
  const current = summary.recommendationTrend?.trend.find(
    (item) => item.period === '0m'
  )

  if (!current) return null

  const buy = current.strongBuy + current.buy
  const sell = current.sell + current.strongSell
  const analystCount = buy + current.hold + sell

  // Sem nenhum analista = sem cobertura, não "0 compras".
  if (analystCount === 0) return null

  return {
    analystCount,
    buy,
    hold: current.hold,
    sell,
    targetPrice: decimalOrNull(summary.financialData?.targetMeanPrice),
  }
}
