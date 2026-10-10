import Decimal from 'decimal.js'
import { Either, left, right } from '@/core/either'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { Alert } from '@/domain/shared/alert'
import { AlertSeverity } from '@/domain/shared/enums/alert-severity'
import { findPeerGroup, PEER_GROUPS_SOURCE } from '../../constants/peer-groups'
import { StockAnalysis } from '../../entities/stock-analysis'
import {
  BAZIN_REQUIRED_YIELD_PERCENT,
  GRAHAM_MULTIPLIER,
} from '../../services/ceiling-price-calculator'
import { DIVIDEND_HISTORY_YEARS } from '../../services/dividend-analyzer'
import { StockAnalyzer } from '../../services/stock-analyzer'
import {
  DIVIDEND_DROP_THRESHOLD_PERCENT,
  MIN_ANALYST_COVERAGE,
  STALE_PRICE_DAYS,
} from '../../services/stock-rules'
import { StockPersonalFit } from '../../services/stock-personal-fit'
import { VALUATION_FAIR_BAND_PERCENT } from '../../services/valuation-rules'
import { StockAnalysisReport } from '../dtos/stock-analysis-report'
import { StockSnapshot } from '../dtos/stock-snapshot'
import { InvalidStockAnalysisRequestError } from '../errors/invalid-stock-analysis-request-error'
import { TickerNotFoundError } from '../errors/ticker-not-found-error'
import { StockDataProvider } from '../gateways/stock-data-provider'
import { toStockReportItem } from '../mappers/stock-report-mapper'
import { StockAnalysesRepository } from '../repositories/stock-analyses-repository'

/** Uma ação sozinha ou "esta com outra". */
export const MAX_TICKERS_PER_ANALYSIS = 2

export interface StockAnalysisItemInput {
  ticker: string
  /** Quanto pretende investir nela (opcional). */
  amount?: Decimal | null
}

interface CreateStockAnalysisUseCaseRequest {
  userId: string
  items: StockAnalysisItemInput[]
}

type CreateStockAnalysisUseCaseResponse = Either<
  | InvalidStockAnalysisRequestError
  | TickerNotFoundError
  | MarketDataUnavailableError,
  { analysis: StockAnalysis }
>

/**
 * Analisa 1 ou 2 ações: dividendos, preço teto, valuation contra concorrentes,
 * tendência dos analistas e encaixe na carteira/perfil. Números e alertas vêm
 * só do código; o LLM não participa (a explicação é outro use-case).
 * Concorrente que a fonte não responde não derruba a análise: vai em
 * `peersUnavailable`. Já a ação pedida que falha derruba tudo.
 */
export class CreateStockAnalysisUseCase {
  constructor(
    private stockDataProvider: StockDataProvider,
    private stockAnalysesRepository: StockAnalysesRepository,
    private positionsRepository: PositionsRepository,
    private investorProfilesRepository: InvestorProfilesRepository,
    private now: () => Date = () => new Date()
  ) {}

  async execute({
    userId,
    items,
  }: CreateStockAnalysisUseCaseRequest): Promise<CreateStockAnalysisUseCaseResponse> {
    const requested = items.map((item) => ({
      ticker: item.ticker.trim().toUpperCase(),
      amount: item.amount ?? null,
    }))

    const invalid = validate(requested)

    if (invalid) return left(new InvalidStockAnalysisRequestError(invalid))

    const snapshots = new Map<string, StockSnapshot>()

    // Ações pedidas: falhou, a análise não existe.
    for (const { ticker } of requested) {
      const result = await this.stockDataProvider.getSnapshot(ticker)

      if (result.isLeft()) return left(result.value)

      snapshots.set(ticker, result.value)
    }

    // Concorrentes: falhou, segue sem ele e avisa.
    const unavailable = new Set<string>()
    const peerTickers = new Set(
      requested.flatMap(({ ticker }) => findPeerGroup(ticker)?.tickers ?? [])
    )

    for (const ticker of peerTickers) {
      if (snapshots.has(ticker)) continue

      const result = await this.stockDataProvider.getSnapshot(ticker)

      if (result.isLeft()) unavailable.add(ticker)
      else snapshots.set(ticker, result.value)
    }

    const [positions, profile] = await Promise.all([
      this.positionsRepository.findManyByUserId(userId),
      this.investorProfilesRepository.findByUserId(userId),
    ])

    const now = this.now()

    const reportItems = requested.map(({ ticker, amount }) => {
      const group = findPeerGroup(ticker)
      const peerTickersOfGroup = (group?.tickers ?? []).filter(
        (peer) => peer !== ticker
      )

      const figures = StockAnalyzer.analyze({
        snapshot: snapshots.get(ticker)!,
        peers: peerTickersOfGroup
          .map((peer) => snapshots.get(peer))
          .filter((peer): peer is StockSnapshot => peer !== undefined),
        now,
      })

      return toStockReportItem({
        figures,
        plannedAmount: amount,
        groupLabel: group?.label ?? null,
        peersUnavailable: peerTickersOfGroup.filter((peer) =>
          unavailable.has(peer)
        ),
        extraAlerts: StockPersonalFit.tickerAlerts({
          ticker,
          plannedAmount: amount,
          group,
          positions,
        }),
      })
    })

    const report: StockAnalysisReport = {
      items: reportItems,
      alerts: [
        ...pairAlerts(requested.map(({ ticker }) => ticker)),
        ...StockPersonalFit.profileAlerts(profile),
      ],
    }

    const analysis = StockAnalysis.create({
      userId: new UniqueEntityId(userId),
      tickers: requested.map(({ ticker }) => ticker),
      result: report,
      assumptions: {
        sources: [...new Set([...snapshots.values()].map((s) => s.source))],
        peerGroups: PEER_GROUPS_SOURCE,
        analyzedAt: now.toISOString(),
        bazinRequiredYieldPercent: BAZIN_REQUIRED_YIELD_PERCENT.toString(),
        grahamMultiplier: GRAHAM_MULTIPLIER.toString(),
        valuationFairBandPercent: VALUATION_FAIR_BAND_PERCENT.toString(),
        dividendHistoryYears: DIVIDEND_HISTORY_YEARS,
        dividendDropThresholdPercent:
          DIVIDEND_DROP_THRESHOLD_PERCENT.toString(),
        stalePriceDays: STALE_PRICE_DAYS,
        minAnalystCoverage: MIN_ANALYST_COVERAGE,
        dividendsAreGross: true,
      },
    })

    await this.stockAnalysesRepository.create(analysis)

    return right({ analysis })
  }
}

function validate(requested: { ticker: string; amount: Decimal | null }[]) {
  if (requested.length === 0) return 'at least one ticker is required'

  if (requested.length > MAX_TICKERS_PER_ANALYSIS) {
    return `at most ${MAX_TICKERS_PER_ANALYSIS} tickers per analysis`
  }

  if (requested.some(({ ticker }) => ticker === '')) {
    return 'ticker must not be empty'
  }

  if (
    new Set(requested.map(({ ticker }) => ticker)).size !== requested.length
  ) {
    return 'tickers must be different'
  }

  if (requested.some(({ amount }) => amount && !amount.greaterThan(0))) {
    return 'amount must be greater than zero'
  }

  return null
}

function pairAlerts(tickers: string[]): Alert[] {
  if (tickers.length !== 2) return []

  const [first, second] = tickers.map(findPeerGroup)

  if (!first || !second || first.key !== second.key) return []

  return [
    {
      code: 'SAME_SECTOR',
      severity: AlertSeverity.WARNING,
      message:
        `As duas são de ${first.label}: comprar as duas não diversifica, ` +
        'porque elas tendem a reagir às mesmas notícias.',
    },
  ]
}
