import Decimal from 'decimal.js'
import { Alert } from '@/domain/shared/alert'
import { StockSnapshot } from '../applications/dtos/stock-snapshot'
import {
  CeilingPrice,
  CeilingPriceCalculator,
} from './ceiling-price-calculator'
import { DividendAnalysis, DividendAnalyzer } from './dividend-analyzer'
import { StockRules } from './stock-rules'
import { MultipleValuation, ValuationRules } from './valuation-rules'

export interface PeerFigures {
  ticker: string
  name: string
  priceToEarnings: Decimal | null
  priceToBook: Decimal | null
  /** Dividend yield dos últimos 12 meses, em %, calculado por nós. */
  dividendYield: Decimal
}

export interface StockFigures {
  snapshot: StockSnapshot
  dividends: DividendAnalysis
  ceilings: CeilingPrice[]
  valuation: {
    priceToEarnings: MultipleValuation
    priceToBook: MultipleValuation
  }
  peers: PeerFigures[]
  /** Alertas da própria ação (sem carteira nem perfil). */
  alerts: Alert[]
}

/**
 * Junta dividendos, preço teto, valuation e alertas de uma ação — puro, sem
 * banco nem LLM. `peers` são os snapshots dos concorrentes, sem a própria ação.
 */
export class StockAnalyzer {
  static analyze(input: {
    snapshot: StockSnapshot
    peers: StockSnapshot[]
    now: Date
  }): StockFigures {
    const { snapshot, peers, now } = input

    const dividends = analyzeDividends(snapshot, now)

    const ceilings = CeilingPriceCalculator.calculate({
      price: snapshot.price,
      averageAnnualDividendPerShare: dividends.averageAnnualPerShare,
      earningsPerShare: snapshot.fundamentals.earningsPerShare,
      bookValuePerShare: snapshot.fundamentals.bookValuePerShare,
    })

    const valuation = {
      priceToEarnings: ValuationRules.compare(
        snapshot.fundamentals.priceToEarnings,
        peers.map((peer) => peer.fundamentals.priceToEarnings)
      ),
      priceToBook: ValuationRules.compare(
        snapshot.fundamentals.priceToBook,
        peers.map((peer) => peer.fundamentals.priceToBook)
      ),
    }

    const hasPeers = Object.values(valuation).some(
      (multiple) => multiple.peerMedian !== null
    )

    return {
      snapshot,
      dividends,
      ceilings,
      valuation,
      peers: peers.map((peer) => ({
        ticker: peer.ticker,
        name: peer.name,
        priceToEarnings: peer.fundamentals.priceToEarnings,
        priceToBook: peer.fundamentals.priceToBook,
        dividendYield: analyzeDividends(peer, now).trailing12mYield,
      })),
      alerts: StockRules.alertsFor({
        snapshot,
        dividends,
        ceilings,
        hasPeers,
        now,
      }),
    }
  }
}

function analyzeDividends(
  snapshot: StockSnapshot,
  now: Date
): DividendAnalysis {
  return DividendAnalyzer.analyze({
    dividends: snapshot.dividends,
    price: snapshot.price,
    now,
    historyFrom: snapshot.dividendsHistoryFrom,
  })
}
