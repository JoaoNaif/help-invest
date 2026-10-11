import Decimal from 'decimal.js'
import { InvestorProfile } from '@/domain/portfolio/entities/investor-profile'
import { Position } from '@/domain/portfolio/entities/position'
import {
  EMERGENCY_RESERVE_MONTHS,
  PortfolioRules,
} from '@/domain/portfolio/services/portfolio-rules'
import { Alert } from '@/domain/shared/alert'
import { FGC_LIMIT_PER_ISSUER } from '@/domain/shared/constants/fgc'
import { AlertSeverity } from '@/domain/shared/enums/alert-severity'
import { formatBRL, formatPercent } from '@/domain/shared/format'
import {
  AssetClassShare,
  AssetClassTarget,
  MarketContext,
  PathNote,
  PortfolioAnalysisReport,
  PortfolioPath,
  ProfileUsed,
  ReserveStatus,
} from '../applications/dtos/portfolio-analysis-report'
import {
  AssetClass,
  isVariableIncome,
  TARGET_ASSET_CLASSES,
  TargetAssetClass,
} from '../entities/enums/asset-class'
import { PathDirection } from '../entities/enums/path-direction'
import { PortfolioStrategy } from '../entities/enums/portfolio-strategy'
import { AssetClassifier, FIXED_INCOME_ASSET_TYPES } from './asset-classifier'
import {
  MarketScenario,
  REAL_RATE_FORMULA,
  REAL_RATE_HIGH_PERCENT,
  REAL_RATE_LOW_PERCENT,
  SCENARIO_NOTE,
  SELIC_HISTORY_MAX_GAP_DAYS,
  SELIC_TREND_MONTHS,
  SELIC_TREND_THRESHOLD_PP,
} from './market-scenario'
import {
  BASE_TARGET_ALLOCATION,
  DEFAULT_HORIZON_MONTHS,
  DEFAULT_RISK_TOLERANCE,
  LONG_HORIZON_MONTHS,
  MEDIUM_HORIZON_VARIABLE_INCOME_CAP_PERCENT,
  SHORT_HORIZON_MONTHS,
  SHORT_HORIZON_VARIABLE_INCOME_CAP_PERCENT,
  TARGET_ALLOCATION_SOURCE,
  TargetAllocation,
  TargetAllocationResult,
  TargetRanges,
} from './target-allocation'
import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'

/** Regra do produto (não é norma): % em fundos/"outros" a partir do qual avisar. */
export const UNCLASSIFIED_ALERT_PERCENT = new Decimal(20)

/** Dado de mercado já lido e validado pelo use-case (`null` = indisponível). */
export interface MarketReading {
  selic: Decimal | null
  cdi: Decimal | null
  ipca12m: Decimal | null
  /** Selic de ~6 meses atrás; `null` = sem histórico suficiente. */
  selicSixMonthsAgo: Decimal | null
  /** Data da Selic/CDI usados. */
  asOf: Date | null
  /** Data do último IPCA mensal usado. */
  ipcaAsOf: Date | null
}

export interface PortfolioAnalyzerInput {
  positions: Position[]
  profile: InvestorProfile | null
  strategy: PortfolioStrategy
  market: MarketReading
  now: Date
}

export interface PortfolioAnalyzerOutput {
  report: PortfolioAnalysisReport
  /** Premissas do cálculo; o use-case acrescenta fontes e data. */
  assumptions: Record<string, unknown>
}

const CLASS_LABELS: Record<AssetClass, string> = {
  [AssetClass.FIXED_POST]: 'renda fixa pós-fixada',
  [AssetClass.FIXED_INFLATION]: 'renda fixa atrelada à inflação',
  [AssetClass.FIXED_PRE]: 'renda fixa prefixada',
  [AssetClass.STOCKS]: 'ações',
  [AssetClass.REAL_ESTATE_FUNDS]: 'fundos imobiliários',
  [AssetClass.FUNDS]: 'fundos',
  [AssetClass.CRYPTO]: 'criptoativos',
  [AssetClass.OTHER]: 'outros',
}

const NO_CLASS_TARGET: AssetClass[] = [AssetClass.FUNDS, AssetClass.OTHER]

/**
 * Motor da análise da carteira — puro, sem banco nem LLM.
 * Posições + perfil + estratégia + mercado → faixas-alvo, caminhos
 * ranqueados e alertas. O foco: carteira, objetivo do usuário e mercado atual.
 */
export class PortfolioAnalyzer {
  static analyze({
    positions,
    profile,
    strategy,
    market,
    now,
  }: PortfolioAnalyzerInput): PortfolioAnalyzerOutput {
    const summary = PortfolioRules.summarize(positions, profile, now)
    const { total } = summary

    const profileUsed: ProfileUsed = profile
      ? {
          riskTolerance: profile.riskTolerance,
          horizonMonths: profile.horizonMonths,
          goal: profile.goal,
          isDefault: false,
        }
      : {
          riskTolerance: DEFAULT_RISK_TOLERANCE,
          horizonMonths: DEFAULT_HORIZON_MONTHS,
          goal: null,
          isDefault: true,
        }

    const amounts = amountsByClass(positions)
    const percentageOf = (amount: Decimal) =>
      total.isZero() ? new Decimal(0) : amount.div(total).times(100)

    const target = TargetAllocation.build({
      riskTolerance: profileUsed.riskTolerance,
      horizonMonths: profileUsed.horizonMonths,
      goal: profileUsed.goal,
      strategy,
    })

    const realRate = MarketScenario.realRate(market.selic, market.ipca12m)
    const trend = MarketScenario.trend(market.selic, market.selicSixMonthsAgo)
    const scenario = MarketScenario.assess(realRate, trend)

    const reserve = profile ? reserveStatus(profile) : null
    const isReserveLow = reserve?.isBelowRecommended ?? false

    const paths = TARGET_ASSET_CLASSES.map((assetClass) =>
      buildPath({
        assetClass,
        current: percentageOf(amounts.get(assetClass) ?? new Decimal(0)),
        range: target.ranges[assetClass],
        target,
        strategy,
        scenario: {
          assessment: scenario,
          effect: MarketScenario.effectOn(scenario.bias, assetClass),
          note: MarketScenario.reasonFor(scenario, assetClass, realRate),
        },
        isReserveLow,
      })
    )

    const ranked = rank(paths)

    const unclassified = NO_CLASS_TARGET.reduce(
      (sum, assetClass) =>
        sum.plus(percentageOf(amounts.get(assetClass) ?? new Decimal(0))),
      new Decimal(0)
    )

    const report: PortfolioAnalysisReport = {
      total: total.toFixed(2),
      current: currentShares(amounts, percentageOf),
      target: targetList(target.ranges),
      reserve,
      paths: ranked.map(({ path }) => path),
      market: marketContext(market, realRate, trend),
      profileUsed,
      alerts: [
        ...summary.alerts,
        ...analysisAlerts({
          isEmpty: positions.length === 0,
          strategy,
          profileUsed,
          target,
          unclassified,
          realRate,
          market,
        }),
      ],
    }

    return {
      report,
      assumptions: {
        strategy,
        targetAllocation: {
          source: TARGET_ALLOCATION_SOURCE,
          riskTolerance: profileUsed.riskTolerance,
          horizonMonths: profileUsed.horizonMonths,
          effectiveHorizonMonths: target.effectiveHorizonMonths,
          goalTreatedAsShortHorizon:
            profileUsed.goal === InvestmentGoal.RESERVE,
          variableIncomeCapPercent:
            target.variableIncomeCapPercent?.toString() ?? null,
          capApplied: target.capApplied,
          horizonRules: {
            [`under${SHORT_HORIZON_MONTHS}Months`]:
              SHORT_HORIZON_VARIABLE_INCOME_CAP_PERCENT.toString(),
            [`under${LONG_HORIZON_MONTHS}Months`]:
              MEDIUM_HORIZON_VARIABLE_INCOME_CAP_PERCENT.toString(),
          },
          strategyAdjustedClasses: target.strategyAdjusted,
          redistributedToFixedIncome: {
            min: target.redistributed.min.toString(),
            max: target.redistributed.max.toString(),
          },
          baseTable: serializeRanges(
            BASE_TARGET_ALLOCATION[profileUsed.riskTolerance]
          ),
          appliedTable: serializeRanges(target.ranges),
          rangesAreBandsNotExactAllocation: true,
        },
        classification: {
          fixedIncomeAssetTypes: FIXED_INCOME_ASSET_TYPES,
          rule:
            'Renda fixa: CDI/SELIC = pós-fixada, IPCA = inflação, PRE = prefixada, ' +
            'sem indexador = outros. ACAO, FII, FUNDO e CRIPTO têm classe própria.',
          classesWithoutTarget: NO_CLASS_TARGET,
          unclassifiedAlertPercent: UNCLASSIFIED_ALERT_PERCENT.toString(),
        },
        scenario: {
          bias: scenario.bias,
          cause: scenario.cause,
          realRateFormula: REAL_RATE_FORMULA,
          ipca12mFormula: 'IPCA acumulado dos últimos 12 meses (composto)',
          realRateHighPercent: REAL_RATE_HIGH_PERCENT.toString(),
          realRateLowPercent: REAL_RATE_LOW_PERCENT.toString(),
          selicTrendMonths: SELIC_TREND_MONTHS,
          selicTrendThresholdPp: SELIC_TREND_THRESHOLD_PP.toString(),
          selicHistoryMaxGapDays: SELIC_HISTORY_MAX_GAP_DAYS,
          note: SCENARIO_NOTE,
        },
        reserve: {
          months: EMERGENCY_RESERVE_MONTHS,
          basedOn: 'reserva declarada no perfil, não nas posições',
        },
        equityMarketData:
          'Sem dados de preço de ações/FIIs (IFIX, yield médio) nesta fase.',
      },
    }
  }
}

interface ScenarioForClass {
  assessment: ReturnType<typeof MarketScenario.assess>
  effect: -1 | 0 | 1
  note: PathNote | null
}

interface RankedPath {
  path: PortfolioPath
  gap: Decimal
  effect: -1 | 0 | 1
}

function amountsByClass(positions: Position[]) {
  const amounts = new Map<AssetClass, Decimal>()

  for (const position of positions) {
    const assetClass = AssetClassifier.classify(position)

    amounts.set(
      assetClass,
      (amounts.get(assetClass) ?? new Decimal(0)).plus(position.investedAmount)
    )
  }

  return amounts
}

function currentShares(
  amounts: Map<AssetClass, Decimal>,
  percentageOf: (amount: Decimal) => Decimal
): AssetClassShare[] {
  const classes: AssetClass[] = [
    ...TARGET_ASSET_CLASSES,
    ...NO_CLASS_TARGET.filter((assetClass) =>
      (amounts.get(assetClass) ?? new Decimal(0)).greaterThan(0)
    ),
  ]

  return classes.map((assetClass) => {
    const amount = amounts.get(assetClass) ?? new Decimal(0)

    return {
      assetClass,
      amount: amount.toFixed(2),
      percentage: percentageOf(amount).toFixed(2),
    }
  })
}

function targetList(ranges: TargetRanges): AssetClassTarget[] {
  return TARGET_ASSET_CLASSES.map((assetClass) => ({
    assetClass,
    min: ranges[assetClass].min.toFixed(2),
    max: ranges[assetClass].max.toFixed(2),
  }))
}

function serializeRanges(ranges: TargetRanges) {
  return Object.fromEntries(
    TARGET_ASSET_CLASSES.map((assetClass) => [
      assetClass,
      {
        min: ranges[assetClass].min.toString(),
        max: ranges[assetClass].max.toString(),
      },
    ])
  )
}

function reserveStatus(profile: InvestorProfile): ReserveStatus {
  const recommended = PortfolioRules.recommendedReserve(profile)

  return {
    recommended: recommended.toFixed(2),
    current: profile.emergencyReserve.toFixed(2),
    gap: Decimal.max(recommended.minus(profile.emergencyReserve), 0).toFixed(2),
    isBelowRecommended: PortfolioRules.isReserveBelowRecommended(profile),
  }
}

function marketContext(
  market: MarketReading,
  realRate: Decimal | null,
  trend: MarketContext['selicTrend']
): MarketContext {
  const date = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null

  return {
    selic: market.selic?.toFixed(2) ?? null,
    cdi: market.cdi?.toFixed(2) ?? null,
    ipca12m: market.ipca12m?.toFixed(2) ?? null,
    realRate: realRate?.toFixed(2) ?? null,
    selicTrend: trend,
    asOf: date(market.asOf),
    ipcaAsOf: date(market.ipcaAsOf),
  }
}

function buildPath({
  assetClass,
  current,
  range,
  target,
  strategy,
  scenario,
  isReserveLow,
}: {
  assetClass: TargetAssetClass
  current: Decimal
  range: { min: Decimal; max: Decimal }
  target: TargetAllocationResult
  strategy: PortfolioStrategy
  scenario: ScenarioForClass
  isReserveLow: boolean
}): RankedPath {
  const direction = current.lessThan(range.min)
    ? PathDirection.INCREASE
    : current.greaterThan(range.max)
      ? PathDirection.REDUCE
      : PathDirection.MAINTAIN

  const gap =
    direction === PathDirection.INCREASE
      ? range.min.minus(current)
      : direction === PathDirection.REDUCE
        ? current.minus(range.max)
        : new Decimal(0)

  const label = CLASS_LABELS[assetClass]
  const reasons: PathNote[] = [
    rangeReason(direction, label, current, range.min, range.max),
  ]

  if (target.strategyAdjusted.includes(assetClass)) {
    reasons.push({
      code: 'STRATEGY_ADJUSTED_RANGE',
      message: `A estratégia escolhida (${strategyLabel(strategy)}) deslocou a faixa desta classe dentro do limite do seu perfil.`,
    })
  }

  if (target.capApplied && isVariableIncome(assetClass)) {
    reasons.push({
      code: 'HORIZON_CAPS_RANGE',
      message: `Pelo seu horizonte (${target.effectiveHorizonMonths} meses), a renda variável soma no máximo ${formatPercent(target.variableIncomeCapPercent!, 0)} da carteira.`,
    })
  }

  if (scenario.note) reasons.push(scenario.note)

  const risks: PathNote[] = []

  if (direction === PathDirection.INCREASE) {
    risks.push(classRisk(assetClass))
  }

  if (
    isVariableIncome(assetClass) &&
    isReserveLow &&
    direction !== PathDirection.REDUCE
  ) {
    risks.push({
      code: 'LOW_RESERVE_FOR_STOCKS',
      message:
        'Sua reserva de emergência está abaixo do recomendado: complete-a em liquidez diária antes de aumentar renda variável, para não ter de resgatar com a carteira em baixa.',
    })
  }

  return {
    gap,
    effect: scenario.effect,
    path: {
      assetClass,
      direction,
      currentPercentage: current.toFixed(2),
      targetMin: range.min.toFixed(2),
      targetMax: range.max.toFixed(2),
      gapPercentage: gap.toFixed(2),
      reasons,
      risks,
    },
  }
}

function rangeReason(
  direction: PathDirection,
  label: string,
  current: Decimal,
  min: Decimal,
  max: Decimal
): PathNote {
  const band = `${formatPercent(min)} a ${formatPercent(max)}`

  switch (direction) {
    case PathDirection.INCREASE:
      return {
        code: 'BELOW_TARGET_RANGE',
        message: `Você tem ${formatPercent(current)} em ${label}, abaixo da faixa-alvo para o seu perfil (${band}).`,
      }
    case PathDirection.REDUCE:
      return {
        code: 'ABOVE_TARGET_RANGE',
        message: `Você tem ${formatPercent(current)} em ${label}, acima da faixa-alvo para o seu perfil (${band}).`,
      }
    default:
      return {
        code: 'WITHIN_TARGET_RANGE',
        message: `Você tem ${formatPercent(current)} em ${label}, dentro da faixa-alvo para o seu perfil (${band}).`,
      }
  }
}

function classRisk(assetClass: TargetAssetClass): PathNote {
  switch (assetClass) {
    case AssetClass.STOCKS:
      return {
        code: 'PRICE_VOLATILITY',
        message:
          'Ações oscilam e podem estar em baixa quando você precisar do dinheiro.',
      }
    case AssetClass.REAL_ESTATE_FUNDS:
      return {
        code: 'PRICE_VOLATILITY',
        message:
          'Cotas de fundos imobiliários oscilam e os rendimentos mensais podem variar.',
      }
    case AssetClass.CRYPTO:
      return {
        code: 'HIGH_VOLATILITY',
        message:
          'Criptoativos têm oscilação muito alta e podem perder boa parte do valor.',
      }
    case AssetClass.FIXED_PRE:
      return {
        code: 'MARK_TO_MARKET',
        message:
          'Taxa prefixada: se os juros de mercado subirem e você resgatar antes do vencimento, pode receber menos.',
      }
    case AssetClass.FIXED_INFLATION:
      return {
        code: 'MARK_TO_MARKET',
        message:
          'Títulos atrelados à inflação oscilam de preço se resgatados antes do vencimento.',
      }
    default:
      return {
        code: 'ISSUER_AND_LIQUIDITY',
        message: `Confira a liquidez e o risco do emissor; o FGC cobre até ${formatBRL(FGC_LIMIT_PER_ISSUER)} por CPF por instituição, e só em CDB, LCI, LCA e LC.`,
      }
  }
}

/**
 * Maior distância até a faixa primeiro; empate pelo cenário (quem ele reforça
 * sobe se a classe precisa aumentar, quem ele enfraquece sobe se precisa
 * reduzir). Dentro da faixa fica por último, na ordem de exibição.
 */
function rank(paths: RankedPath[]) {
  return paths
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const byGap = b.item.gap.comparedTo(a.item.gap)

      if (byGap !== 0) return byGap

      const signed = (ranked: RankedPath) =>
        ranked.path.direction === PathDirection.REDUCE
          ? -ranked.effect
          : ranked.effect
      const byScenario = signed(b.item) - signed(a.item)

      return byScenario !== 0 ? byScenario : a.index - b.index
    })
    .map(({ item }) => item)
}

function strategyLabel(strategy: PortfolioStrategy) {
  switch (strategy) {
    case PortfolioStrategy.MAX_RETURN:
      return 'rentabilizar ao máximo'
    case PortfolioStrategy.INCOME:
      return 'gerar renda recorrente'
    case PortfolioStrategy.PROTECT:
      return 'proteger o patrimônio'
    default:
      return 'equilibrar'
  }
}

function analysisAlerts({
  isEmpty,
  strategy,
  profileUsed,
  target,
  unclassified,
  realRate,
  market,
}: {
  isEmpty: boolean
  strategy: PortfolioStrategy
  profileUsed: ProfileUsed
  target: TargetAllocationResult
  unclassified: Decimal
  realRate: Decimal | null
  market: MarketReading
}): Alert[] {
  const alerts: Alert[] = []

  if (isEmpty) {
    alerts.push({
      code: 'PORTFOLIO_EMPTY',
      severity: AlertSeverity.INFO,
      message:
        'Você ainda não cadastrou posições: os caminhos abaixo mostram a faixa-alvo completa para o seu perfil.',
    })
  }

  if (profileUsed.goal === InvestmentGoal.RESERVE) {
    alerts.push({
      code: 'GOAL_IS_RESERVE',
      severity: AlertSeverity.INFO,
      message:
        'Seu objetivo é formar reserva: a renda variável foi limitada como em um horizonte curto.',
    })
  }

  if (target.capApplied) {
    alerts.push({
      code: 'HORIZON_CAPS_VARIABLE_INCOME',
      severity: AlertSeverity.INFO,
      message: `Pelo horizonte considerado (${target.effectiveHorizonMonths} meses), a renda variável (ações, FIIs e criptoativos) soma no máximo ${formatPercent(target.variableIncomeCapPercent!, 0)} da carteira.`,
    })
  }

  if (
    strategy === PortfolioStrategy.MAX_RETURN &&
    (profileUsed.riskTolerance !== RiskTolerance.HIGH || target.capApplied)
  ) {
    alerts.push({
      code: 'STRATEGY_LIMITED_BY_PROFILE',
      severity: AlertSeverity.INFO,
      message:
        'Rentabilizar ao máximo respeita o seu perfil: com a tolerância a risco e o horizonte considerados, a renda variável tem um teto e a faixa-alvo não passa dele.',
    })
  }

  if (unclassified.greaterThan(UNCLASSIFIED_ALERT_PERCENT)) {
    alerts.push({
      code: 'UNCLASSIFIED_ALLOCATION',
      severity: AlertSeverity.WARNING,
      message: `${formatPercent(unclassified)} da carteira está em fundos ou ativos sem classificação por indexador. O motor não sabe o que há dentro deles e não compara com a faixa-alvo.`,
    })
  }

  if (!market.selic || !market.ipca12m || !realRate) {
    alerts.push({
      code: 'MARKET_DATA_UNAVAILABLE',
      severity: AlertSeverity.WARNING,
      message:
        'Faltam dados recentes de Selic ou IPCA: o cenário de juros ficou de fora e os caminhos seguem só a faixa-alvo.',
    })
  }

  alerts.push({
    code: 'NO_EQUITY_MARKET_DATA',
    severity: AlertSeverity.INFO,
    message:
      'Esta análise não usa preços de ações nem de fundos imobiliários (sem índices como IFIX ou yield médio): ela compara sua carteira com a faixa-alvo e com o cenário de juros.',
  })

  return alerts
}
