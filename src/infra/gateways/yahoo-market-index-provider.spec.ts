import { describe, expect, it, vi } from 'vitest'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import { MarketIndexCode } from '@/domain/market-overview/applications/dtos/market-index'
import {
  FAILURE_TTL_MS,
  SUCCESS_TTL_MS,
  YahooMarketIndexProvider,
} from './yahoo-market-index-provider'

const NOW = new Date('2026-10-11T12:00:00Z')

// 2026-10-07, 08 e 09 às 13:00 UTC (pregão da B3).
const T1 = Date.UTC(2026, 9, 7, 13) / 1000
const T2 = Date.UTC(2026, 9, 8, 13) / 1000
const T3 = Date.UTC(2026, 9, 9, 13) / 1000

function chartBody(
  timestamp: number[] = [T1, T2, T3],
  close: (number | null)[] = [208_000.5, null, 209_066.9]
) {
  return {
    chart: {
      result: [
        {
          meta: { symbol: '^BVSP', instrumentType: 'INDEX' },
          timestamp,
          indicators: { quote: [{ close }] },
        },
      ],
      error: null,
    },
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function makeSut(
  respond: () => Response | Promise<Response>,
  clock: { now: Date } = { now: NOW }
) {
  const fetchFn = vi.fn<typeof fetch>(async () => respond())

  return {
    fetchFn,
    clock,
    sut: new YahooMarketIndexProvider(
      fetchFn as unknown as typeof fetch,
      () => clock.now
    ),
  }
}

describe('Yahoo Market Index Provider', () => {
  it('should read the Ibovespa daily closes, skipping days without a close', async () => {
    const { sut, fetchFn } = makeSut(() => jsonResponse(chartBody()))

    const result = await sut.getHistory(MarketIndexCode.IBOVESPA)

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      expect(result.value.code).toBe('IBOVESPA')
      expect(result.value.source).toBe('Yahoo Finance (^BVSP)')
      expect(
        result.value.closes.map((item) => [
          item.date.toISOString().slice(0, 10),
          item.close.toString(),
        ])
      ).toEqual([
        ['2026-10-07', '208000.5'],
        ['2026-10-09', '209066.9'],
      ])
    }

    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]

    expect(url).toContain('/v8/finance/chart/%5EBVSP')
    expect(url).toContain('range=2y')
    // com 1mo o Yahoo descarta dados: o intervalo diário é obrigatório
    expect(url).toContain('interval=1d')
    expect((init.headers as Record<string, string>)['User-Agent']).toContain(
      'Mozilla'
    )
  })

  it('should ask for the IFIX by its own symbol and return whatever the source has', async () => {
    const { sut, fetchFn } = makeSut(() =>
      jsonResponse(chartBody([T3], [3988.54]))
    )

    const result = await sut.getHistory(MarketIndexCode.IFIX)

    expect(fetchFn.mock.calls[0][0]).toContain('/chart/IFIX.SA')
    expect(result.isRight() && result.value.closes).toHaveLength(1)
    expect(result.isRight() && result.value.source).toBe(
      'Yahoo Finance (IFIX.SA)'
    )
  })

  it.each([
    ['HTTP 404', () => jsonResponse({ chart: { result: null } }, 404)],
    ['HTTP 401', () => jsonResponse({}, 401)],
    ['HTTP 429', () => jsonResponse({}, 429)],
    ['HTTP 500', () => jsonResponse({}, 500)],
    ['body outside the format', () => jsonResponse({ unexpected: true })],
    ['empty result', () => jsonResponse({ chart: { result: [] } })],
    ['no valid close', () => jsonResponse(chartBody([T1, T2], [null, null]))],
    ['invalid JSON', () => new Response('<html>', { status: 200 })],
  ])('should be unavailable on %s', async (_, respond) => {
    const { sut } = makeSut(respond)

    const result = await sut.getHistory(MarketIndexCode.IBOVESPA)

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(MarketDataUnavailableError)
  })

  it('should be unavailable when the network fails', async () => {
    const { sut } = makeSut(() => {
      throw new TypeError('fetch failed')
    })

    const result = await sut.getHistory(MarketIndexCode.IBOVESPA)

    expect(result.isLeft()).toBe(true)
  })

  describe('cache', () => {
    it('should not hit the source again within the success TTL', async () => {
      const { sut, fetchFn, clock } = makeSut(() => jsonResponse(chartBody()))

      await sut.getHistory(MarketIndexCode.IBOVESPA)
      clock.now = new Date(NOW.getTime() + SUCCESS_TTL_MS - 1)
      await sut.getHistory(MarketIndexCode.IBOVESPA)

      expect(fetchFn).toHaveBeenCalledTimes(1)
    })

    it('should refetch after the success TTL', async () => {
      const { sut, fetchFn, clock } = makeSut(() => jsonResponse(chartBody()))

      await sut.getHistory(MarketIndexCode.IBOVESPA)
      clock.now = new Date(NOW.getTime() + SUCCESS_TTL_MS + 1)
      await sut.getHistory(MarketIndexCode.IBOVESPA)

      expect(fetchFn).toHaveBeenCalledTimes(2)
    })

    it('should cache each index on its own', async () => {
      const { sut, fetchFn } = makeSut(() => jsonResponse(chartBody()))

      await sut.getHistory(MarketIndexCode.IBOVESPA)
      await sut.getHistory(MarketIndexCode.IFIX)

      expect(fetchFn).toHaveBeenCalledTimes(2)
    })

    it('should keep a failure for a short time only', async () => {
      let status = 429
      const { sut, fetchFn, clock } = makeSut(() =>
        status === 200 ? jsonResponse(chartBody()) : jsonResponse({}, status)
      )

      const first = await sut.getHistory(MarketIndexCode.IBOVESPA)

      // dentro dos 5 min: não bate na fonte de novo
      clock.now = new Date(NOW.getTime() + FAILURE_TTL_MS - 1)
      const second = await sut.getHistory(MarketIndexCode.IBOVESPA)

      expect(first.isLeft()).toBe(true)
      expect(second.isLeft()).toBe(true)
      expect(fetchFn).toHaveBeenCalledTimes(1)

      // passou o prazo e a fonte voltou: recupera sem esperar 1 h
      status = 200
      clock.now = new Date(NOW.getTime() + FAILURE_TTL_MS + 1)
      const third = await sut.getHistory(MarketIndexCode.IBOVESPA)

      expect(third.isRight()).toBe(true)
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })
  })
})
