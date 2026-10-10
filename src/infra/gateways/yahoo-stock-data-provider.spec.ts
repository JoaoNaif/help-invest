import { describe, expect, it, vi } from 'vitest'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import { TickerNotFoundError } from '@/domain/stock-analysis/applications/errors/ticker-not-found-error'
import { YahooStockDataProvider } from './yahoo-stock-data-provider'

const NOW = new Date('2026-10-09T12:00:00Z')

function chartBody(overrides: Record<string, unknown> = {}) {
  return {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: 24.64,
            regularMarketTime: 1_791_586_290,
            longName: 'Banco do Brasil S.A.',
            shortName: 'BRASIL ON',
            firstTradeDate: 946_900_800, // 2000
            ...overrides,
          },
          events: {
            dividends: {
              '1788307200': { amount: 0.10527, date: 1_788_307_200 },
              '1772496000': { amount: 0.070142, date: 1_772_496_000 },
            },
          },
        },
      ],
      error: null,
    },
  }
}

function summaryBody(overrides: Record<string, unknown> = {}) {
  return {
    quoteSummary: {
      result: [
        {
          defaultKeyStatistics: {
            priceToBook: { raw: 0.7729711 },
            bookValue: { raw: 31.877 },
            trailingEps: { raw: 2.15 },
          },
          financialData: {
            returnOnEquity: { raw: 0.10546 },
            targetMeanPrice: { raw: 24.82308 },
          },
          summaryDetail: {
            trailingPE: { raw: 11.46 },
            dividendYield: { raw: 0.0057 },
          },
          recommendationTrend: {
            trend: [
              {
                period: '0m',
                strongBuy: 1,
                buy: 1,
                hold: 8,
                sell: 1,
                strongSell: 2,
              },
              {
                period: '-1m',
                strongBuy: 0,
                buy: 0,
                hold: 0,
                sell: 0,
                strongSell: 0,
              },
            ],
          },
          assetProfile: { sector: 'Financial Services' },
          ...overrides,
        },
      ],
      error: null,
    },
  }
}

interface Routes {
  chart?: () => Response
  summary?: () => Response
  cookie?: () => Response
  crumb?: () => Response
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

/** `fetch` falso: roteia pela URL; o que não for informado responde "ok". */
function makeFetch(routes: Routes = {}) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input)

    if (url.startsWith('https://fc.yahoo.com')) {
      return (
        routes.cookie?.() ??
        new Response('', {
          status: 404,
          headers: { 'set-cookie': 'A3=d=AQABxyz; Domain=.yahoo.com; Path=/' },
        })
      )
    }

    if (url.includes('/getcrumb')) {
      return routes.crumb?.() ?? new Response('abc123XYZ.-/9', { status: 200 })
    }

    if (url.includes('/v8/finance/chart')) {
      return routes.chart?.() ?? json(chartBody())
    }

    return routes.summary?.() ?? json(summaryBody())
  })
}

function make(routes?: Routes) {
  const fetchFn = makeFetch(routes)

  return {
    fetchFn,
    sut: new YahooStockDataProvider(fetchFn, () => NOW),
  }
}

describe('Yahoo Stock Data Provider', () => {
  it('should be able to build a snapshot', async () => {
    const { sut } = make()

    const result = await sut.getSnapshot('BBAS3')

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      const snapshot = result.value

      expect(snapshot.ticker).toBe('BBAS3')
      expect(snapshot.name).toBe('Banco do Brasil S.A.')
      expect(snapshot.sector).toBe('Financial Services')
      expect(snapshot.price.toString()).toBe('24.64')
      expect(snapshot.source).toBe('Yahoo Finance')
      expect(snapshot.fundamentals.priceToBook?.toString()).toBe('0.7729711')
      expect(snapshot.fundamentals.bookValuePerShare?.toString()).toBe('31.877')
      expect(snapshot.fundamentals.earningsPerShare?.toString()).toBe('2.15')
      expect(snapshot.fundamentals.priceToEarnings?.toString()).toBe('11.46')
      // fração do Yahoo vira % no domínio
      expect(snapshot.fundamentals.returnOnEquity?.toString()).toBe('10.546')
    }
  })

  it('should map dividends ordered by ex date, with no payment date', async () => {
    const { sut } = make()

    const result = await sut.getSnapshot('BBAS3')

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      const { dividends } = result.value

      expect(dividends).toHaveLength(2)
      expect(dividends[0].exDate.getTime()).toBeLessThan(
        dividends[1].exDate.getTime()
      )
      expect(dividends[1].amountPerShare.toString()).toBe('0.10527')
      expect(dividends[0].paymentDate).toBeNull()
    }
  })

  it('should map the analyst consensus summing strong votes', async () => {
    const { sut } = make()

    const result = await sut.getSnapshot('BBAS3')

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      expect(result.value.consensus).toMatchObject({
        analystCount: 13,
        buy: 2,
        hold: 8,
        sell: 3,
      })
      expect(result.value.consensus?.targetPrice?.toString()).toBe('24.82308')
    }
  })

  it('should return a null consensus when there are no analysts', async () => {
    const { sut } = make({
      summary: () =>
        json(
          summaryBody({
            recommendationTrend: {
              trend: [
                {
                  period: '0m',
                  strongBuy: 0,
                  buy: 0,
                  hold: 0,
                  sell: 0,
                  strongSell: 0,
                },
              ],
            },
          })
        ),
    })

    const result = await sut.getSnapshot('BBAS3')

    expect(result.isRight() && result.value.consensus).toBeNull()
  })

  it('should turn missing fields into null, never zero', async () => {
    const { sut } = make({
      summary: () =>
        json(
          summaryBody({
            defaultKeyStatistics: { priceToBook: {}, bookValue: {} },
            financialData: {},
            summaryDetail: {},
            assetProfile: {},
          })
        ),
    })

    const result = await sut.getSnapshot('BBAS3')

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      expect(result.value.fundamentals).toEqual({
        priceToEarnings: null,
        priceToBook: null,
        earningsPerShare: null,
        bookValuePerShare: null,
        returnOnEquity: null,
      })
      expect(result.value.sector).toBeNull()
    }
  })

  it('should limit the dividend history to the first trade date', async () => {
    const { sut } = make({
      chart: () =>
        json(
          chartBody({ firstTradeDate: Math.floor(Date.UTC(2023, 5, 1) / 1000) })
        ),
    })

    const result = await sut.getSnapshot('BBAS3')

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      expect(result.value.dividendsHistoryFrom).toEqual(
        new Date(Date.UTC(2023, 5, 1))
      )
    }
  })

  it('should send the .SA symbol, the cookie and the crumb', async () => {
    const { sut, fetchFn } = make()

    await sut.getSnapshot(' bbas3 ')

    const urls = fetchFn.mock.calls.map(([url]) => String(url))
    const summaryCall = fetchFn.mock.calls.find(([url]) =>
      String(url).includes('quoteSummary')
    )!

    expect(urls.some((url) => url.includes('/chart/BBAS3.SA'))).toBe(true)
    expect(String(summaryCall[0])).toContain('/quoteSummary/BBAS3.SA')
    expect(String(summaryCall[0])).toContain('crumb=abc123XYZ.-%2F9')
    expect(
      (summaryCall[1] as { headers: Record<string, string> }).headers
    ).toMatchObject({ Cookie: 'A3=d=AQABxyz' })
  })

  it('should ask for daily bars so the source keeps every dividend', async () => {
    // Com interval=1mo o Yahoo descarta proventos (visto em ITUB4).
    const { sut, fetchFn } = make()

    await sut.getSnapshot('ITUB4')

    const chartCall = fetchFn.mock.calls.find(([url]) =>
      String(url).includes('/v8/finance/chart')
    )!

    expect(String(chartCall[0])).toContain('interval=1d')
    expect(String(chartCall[0])).toContain('events=div')
  })

  it('should reuse the session between calls', async () => {
    const { sut, fetchFn } = make()

    await sut.getSnapshot('BBAS3')
    await sut.getSnapshot('ITUB4')

    const crumbCalls = fetchFn.mock.calls.filter(([url]) =>
      String(url).includes('/getcrumb')
    )

    expect(crumbCalls).toHaveLength(1)
  })

  it('should renew the session once when the crumb expires', async () => {
    let summaryCalls = 0
    const { sut, fetchFn } = make({
      summary: () => {
        summaryCalls += 1

        return summaryCalls === 1
          ? json({ finance: { error: { code: 'Unauthorized' } } }, 401)
          : json(summaryBody())
      },
    })

    const result = await sut.getSnapshot('BBAS3')

    expect(result.isRight()).toBe(true)
    expect(
      fetchFn.mock.calls.filter(([url]) => String(url).includes('/getcrumb'))
    ).toHaveLength(2)
  })

  it('should give up after a second 401', async () => {
    const { sut } = make({ summary: () => json({}, 401) })

    const result = await sut.getSnapshot('BBAS3')

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(MarketDataUnavailableError)
  })

  it('should reject a malformed ticker without calling the source', async () => {
    const { sut, fetchFn } = make()

    const result = await sut.getSnapshot('../etc?x=1')

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(TickerNotFoundError)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('should return TickerNotFoundError when the source answers 404', async () => {
    const { sut } = make({
      chart: () => json({ chart: { result: null, error: {} } }, 404),
    })

    const result = await sut.getSnapshot('ZZZZ3')

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(TickerNotFoundError)
  })

  it('should be unavailable when the network fails', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    const sut = new YahooStockDataProvider(fetchFn, () => NOW)

    const result = await sut.getSnapshot('BBAS3')

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(MarketDataUnavailableError)
  })

  it('should be unavailable on HTTP 429 or a body outside the format', async () => {
    const limited = make({ chart: () => json({}, 429) })
    const malformed = make({ chart: () => json({ chart: { result: [] } }) })

    const first = await limited.sut.getSnapshot('BBAS3')
    const second = await malformed.sut.getSnapshot('BBAS3')

    expect(first.value).toBeInstanceOf(MarketDataUnavailableError)
    expect(second.value).toBeInstanceOf(MarketDataUnavailableError)
  })

  it('should be unavailable when the crumb is not a crumb', async () => {
    const { sut } = make({
      crumb: () =>
        new Response('<html>Too Many Requests</html>', { status: 200 }),
    })

    const result = await sut.getSnapshot('BBAS3')

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(MarketDataUnavailableError)
  })
})
