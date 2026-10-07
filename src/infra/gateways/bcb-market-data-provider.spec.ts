import { describe, expect, it, vi } from 'vitest'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import { BcbMarketDataProvider } from './bcb-market-data-provider'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, ...init })
}

const from = new Date(Date.UTC(2026, 8, 1))
const to = new Date(Date.UTC(2026, 9, 6))

describe('BCB Market Data Provider', () => {
  it('should be able to fetch a series', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse([
        { data: '01/09/2026', valor: '13.90' },
        { data: '02/09/2026', valor: '13.90' },
      ])
    )
    const sut = new BcbMarketDataProvider(fetchFn)

    const result = await sut.fetchSeries('CDI', from, to)

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      expect(result.value.source).toBe('BCB SGS 4389')
      expect(result.value.points).toHaveLength(2)
      expect(result.value.points[0].date).toEqual(new Date('2026-09-01'))
      expect(result.value.points[0].value.toString()).toBe('13.9')
    }
  })

  it('should ask for the right series and period', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse([]))
    const sut = new BcbMarketDataProvider(fetchFn)

    await sut.fetchSeries('SELIC', from, to)
    await sut.fetchSeries('IPCA', from, to)

    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=01/09/2026&dataFinal=06/10/2026'
    )
    expect(fetchFn.mock.calls[1][0]).toContain('bcdata.sgs.433')
  })

  it('should accept an empty series and negative values', async () => {
    const sut = new BcbMarketDataProvider(
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(
          jsonResponse([{ data: '01/08/2026', valor: '-0.32' }])
        )
    )

    const empty = await sut.fetchSeries('CDI', from, to)
    const negative = await sut.fetchSeries('IPCA', from, to)

    expect(empty.isRight() && empty.value.points).toEqual([])
    expect(negative.isRight() && negative.value.points[0].value.toString()).toBe(
      '-0.32'
    )
  })

  it.each([
    ['HTTP error', () => Promise.resolve(new Response('', { status: 503 }))],
    ['network failure', () => Promise.reject(new TypeError('fetch failed'))],
    ['body that is not JSON', () => Promise.resolve(new Response('<html>'))],
    [
      'error object instead of a list',
      () => Promise.resolve(jsonResponse({ error: 'invalid range' })),
    ],
    [
      'malformed value',
      () =>
        Promise.resolve(jsonResponse([{ data: '01/09/2026', valor: 'abc' }])),
    ],
    [
      'malformed date',
      () =>
        Promise.resolve(jsonResponse([{ data: '2026-09-01', valor: '13.9' }])),
    ],
  ])('should return MarketDataUnavailableError on %s', async (_, respond) => {
    const sut = new BcbMarketDataProvider(vi.fn().mockImplementation(respond))

    const result = await sut.fetchSeries('CDI', from, to)

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(MarketDataUnavailableError)
  })
})
