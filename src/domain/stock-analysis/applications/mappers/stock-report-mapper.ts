import Decimal from 'decimal.js'
import { Alert } from '@/domain/shared/alert'
import { MultipleValuation } from '../../services/valuation-rules'
import { StockFigures } from '../../services/stock-analyzer'
import {
  StockReportItem,
  StockMultipleReport,
} from '../dtos/stock-analysis-report'

function fixed(value: Decimal | null) {
  return value ? value.toFixed(2) : null
}

function multiple(valuation: MultipleValuation): StockMultipleReport {
  return {
    value: fixed(valuation.value),
    peerMedian: fixed(valuation.peerMedian),
    diffPercent: fixed(valuation.diffPercent),
    verdict: valuation.verdict,
  }
}

/** Figuras do motor (com `Decimal`) → formato gravado e devolvido ao front. */
export function toStockReportItem(input: {
  figures: StockFigures
  plannedAmount: Decimal | null
  groupLabel: string | null
  peersUnavailable: string[]
  extraAlerts: Alert[]
}): StockReportItem {
  const { figures, plannedAmount, groupLabel, peersUnavailable, extraAlerts } =
    input
  const { snapshot, dividends } = figures
  const consensus = snapshot.consensus

  return {
    ticker: snapshot.ticker,
    name: snapshot.name,
    sector: snapshot.sector,
    price: snapshot.price.toFixed(2),
    priceDate: snapshot.priceDate.toISOString(),
    plannedAmount: fixed(plannedAmount),
    source: snapshot.source,
    fundamentals: {
      priceToEarnings: fixed(snapshot.fundamentals.priceToEarnings),
      priceToBook: fixed(snapshot.fundamentals.priceToBook),
      earningsPerShare: fixed(snapshot.fundamentals.earningsPerShare),
      bookValuePerShare: fixed(snapshot.fundamentals.bookValuePerShare),
      returnOnEquity: fixed(snapshot.fundamentals.returnOnEquity),
    },
    dividends: {
      trailing12mPerShare: dividends.trailing12mPerShare.toFixed(2),
      trailing12mYield: dividends.trailing12mYield.toFixed(2),
      averageAnnualPerShare: fixed(dividends.averageAnnualPerShare),
      yearsCovered: dividends.yearsCovered,
      yearsWithPayment: dividends.yearsWithPayment,
      consistent: dividends.consistent,
      upcoming: dividends.upcoming
        ? {
            exDate: dividends.upcoming.exDate.toISOString().slice(0, 10),
            amountPerShare: dividends.upcoming.amountPerShare.toFixed(4),
          }
        : null,
      dateKind: 'EX',
    },
    ceilingPrices: figures.ceilings.map((ceiling) => ({
      method: ceiling.method,
      value: ceiling.value.toFixed(2),
      upsidePercent: ceiling.upsidePercent.toFixed(2),
    })),
    valuation: {
      group: groupLabel,
      priceToEarnings: multiple(figures.valuation.priceToEarnings),
      priceToBook: multiple(figures.valuation.priceToBook),
      peers: figures.peers.map((peer) => ({
        ticker: peer.ticker,
        name: peer.name,
        priceToEarnings: fixed(peer.priceToEarnings),
        priceToBook: fixed(peer.priceToBook),
        dividendYield: peer.dividendYield.toFixed(2),
      })),
      peersUnavailable,
    },
    consensus: consensus
      ? {
          analystCount: consensus.analystCount,
          buy: consensus.buy,
          hold: consensus.hold,
          sell: consensus.sell,
          targetPrice: fixed(consensus.targetPrice),
        }
      : null,
    alerts: [...figures.alerts, ...extraAlerts],
  }
}
