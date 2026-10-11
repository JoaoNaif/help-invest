import Decimal from 'decimal.js'
import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'
import {
  AssetClass,
  TARGET_ASSET_CLASSES,
  TargetAssetClass,
  VARIABLE_INCOME_CLASSES,
} from '../entities/enums/asset-class'
import { PortfolioStrategy } from '../entities/enums/portfolio-strategy'

export interface TargetRange {
  /** % da carteira. */
  min: Decimal
  max: Decimal
}

export type TargetRanges = Record<TargetAssetClass, TargetRange>

/** Regra do produto — não é norma. Ajustável; mude a versão ao mudar a tabela. */
export const TARGET_ALLOCATION_SOURCE =
  'Regra do produto (não é norma), versão 1, definida em 2026-10-10'

/** Premissas quando o usuário ainda não preencheu o perfil. */
export const DEFAULT_RISK_TOLERANCE = RiskTolerance.MEDIUM
export const DEFAULT_HORIZON_MONTHS = 60

/** Abaixo disso, renda variável (ações + FIIs + cripto) soma no máximo 10%. */
export const SHORT_HORIZON_MONTHS = 36
export const SHORT_HORIZON_VARIABLE_INCOME_CAP_PERCENT = new Decimal(10)

/** De 36 a 59 meses, renda variável soma no máximo 25%. */
export const LONG_HORIZON_MONTHS = 60
export const MEDIUM_HORIZON_VARIABLE_INCOME_CAP_PERCENT = new Decimal(25)

const range = (min: string, max: string): TargetRange => ({
  min: new Decimal(min),
  max: new Decimal(max),
})

/**
 * Faixa-alvo por classe, em % da carteira, para horizonte ≥ 60 meses.
 * As faixas **não** precisam somar 100: são bandas, não uma alocação exata.
 */
export const BASE_TARGET_ALLOCATION: Record<RiskTolerance, TargetRanges> = {
  [RiskTolerance.LOW]: {
    [AssetClass.FIXED_POST]: range('40', '60'),
    [AssetClass.FIXED_INFLATION]: range('20', '35'),
    [AssetClass.FIXED_PRE]: range('0', '15'),
    [AssetClass.STOCKS]: range('0', '5'),
    [AssetClass.REAL_ESTATE_FUNDS]: range('0', '10'),
    [AssetClass.CRYPTO]: range('0', '0'),
  },
  [RiskTolerance.MEDIUM]: {
    [AssetClass.FIXED_POST]: range('20', '40'),
    [AssetClass.FIXED_INFLATION]: range('15', '30'),
    [AssetClass.FIXED_PRE]: range('0', '15'),
    [AssetClass.STOCKS]: range('10', '25'),
    [AssetClass.REAL_ESTATE_FUNDS]: range('10', '20'),
    [AssetClass.CRYPTO]: range('0', '5'),
  },
  [RiskTolerance.HIGH]: {
    [AssetClass.FIXED_POST]: range('10', '25'),
    [AssetClass.FIXED_INFLATION]: range('10', '20'),
    [AssetClass.FIXED_PRE]: range('0', '10'),
    [AssetClass.STOCKS]: range('25', '40'),
    [AssetClass.REAL_ESTATE_FUNDS]: range('10', '25'),
    [AssetClass.CRYPTO]: range('0', '10'),
  },
}

/** Para onde vai o que a regra tira da renda variável (meio a meio). */
const SAFE_HAVENS: readonly TargetAssetClass[] = [
  AssetClass.FIXED_POST,
  AssetClass.FIXED_INFLATION,
]

export interface TargetAllocationInput {
  riskTolerance: RiskTolerance
  horizonMonths: number
  goal: InvestmentGoal | null
  strategy: PortfolioStrategy
}

export interface TargetAllocationResult {
  ranges: TargetRanges
  /** Horizonte usado; objetivo "reserva" é tratado como curto. */
  effectiveHorizonMonths: number
  /** Teto da renda variável pelo horizonte; `null` = sem teto. */
  variableIncomeCapPercent: Decimal | null
  /** `true` se o teto de horizonte encolheu as faixas de renda variável. */
  capApplied: boolean
  /** Classes cuja faixa a estratégia mexeu. */
  strategyAdjusted: TargetAssetClass[]
  /** Quanto saiu da renda variável e foi para a renda fixa segura (soma dos 2). */
  redistributed: { min: Decimal; max: Decimal }
}

/**
 * Tabela-alvo para o investidor: parte da tolerância a risco, aplica a
 * estratégia **dentro do teto de risco** e limita a renda variável pelo
 * horizonte. Puro — a mesma entrada dá sempre as mesmas faixas.
 */
export class TargetAllocation {
  static build({
    riskTolerance,
    horizonMonths,
    goal,
    strategy,
  }: TargetAllocationInput): TargetAllocationResult {
    const base = BASE_TARGET_ALLOCATION[riskTolerance]
    const ranges = cloneRanges(base)
    const strategyAdjusted = new Set<TargetAssetClass>()

    // Metade superior: o piso sobe até o meio da faixa; o teto não muda.
    const raiseFloor = (assetClass: TargetAssetClass) => {
      const current = ranges[assetClass]
      const middle = current.min.plus(current.max).div(2)

      if (middle.greaterThan(current.min)) {
        current.min = middle
        strategyAdjusted.add(assetClass)
      }
    }

    // Metade inferior: o teto desce até o meio da faixa; o piso não muda.
    const lowerCeiling = (assetClass: TargetAssetClass) => {
      const current = ranges[assetClass]
      const middle = current.min.plus(current.max).div(2)

      if (middle.lessThan(current.max)) {
        current.max = middle
        strategyAdjusted.add(assetClass)
      }
    }

    switch (strategy) {
      case PortfolioStrategy.MAX_RETURN:
        VARIABLE_INCOME_CLASSES.forEach(raiseFloor)
        break
      case PortfolioStrategy.PROTECT:
        VARIABLE_INCOME_CLASSES.forEach(lowerCeiling)
        break
      case PortfolioStrategy.INCOME:
        raiseFloor(AssetClass.REAL_ESTATE_FUNDS)
        raiseFloor(AssetClass.FIXED_INFLATION)
        break
      case PortfolioStrategy.BALANCE:
        break
    }

    const effectiveHorizonMonths =
      goal === InvestmentGoal.RESERVE
        ? Math.min(horizonMonths, SHORT_HORIZON_MONTHS - 1)
        : horizonMonths
    const cap = variableIncomeCap(effectiveHorizonMonths)
    let capApplied = false

    if (cap) {
      const sumMax = sumOf(VARIABLE_INCOME_CLASSES, ranges, 'max')

      if (sumMax.greaterThan(cap)) {
        const factor = cap.div(sumMax)

        for (const assetClass of VARIABLE_INCOME_CLASSES) {
          ranges[assetClass].min = ranges[assetClass].min.times(factor)
          ranges[assetClass].max = ranges[assetClass].max.times(factor)
        }

        capApplied = true
      }
    }

    // O que a renda variável perdeu (horizonte ou estratégia) vai para a
    // renda fixa segura, meio a meio: o excedente não some.
    const removedMin = Decimal.max(
      sumOf(VARIABLE_INCOME_CLASSES, base, 'min').minus(
        sumOf(VARIABLE_INCOME_CLASSES, ranges, 'min')
      ),
      0
    )
    const removedMax = Decimal.max(
      sumOf(VARIABLE_INCOME_CLASSES, base, 'max').minus(
        sumOf(VARIABLE_INCOME_CLASSES, ranges, 'max')
      ),
      0
    )

    for (const assetClass of SAFE_HAVENS) {
      const current = ranges[assetClass]
      const share = SAFE_HAVENS.length

      current.min = Decimal.min(current.min.plus(removedMin.div(share)), 100)
      current.max = Decimal.min(current.max.plus(removedMax.div(share)), 100)
    }

    return {
      ranges,
      effectiveHorizonMonths,
      variableIncomeCapPercent: cap,
      capApplied,
      strategyAdjusted: [...strategyAdjusted],
      redistributed: { min: removedMin, max: removedMax },
    }
  }
}

function variableIncomeCap(horizonMonths: number): Decimal | null {
  if (horizonMonths < SHORT_HORIZON_MONTHS) {
    return SHORT_HORIZON_VARIABLE_INCOME_CAP_PERCENT
  }

  if (horizonMonths < LONG_HORIZON_MONTHS) {
    return MEDIUM_HORIZON_VARIABLE_INCOME_CAP_PERCENT
  }

  return null
}

function cloneRanges(ranges: TargetRanges): TargetRanges {
  return Object.fromEntries(
    TARGET_ASSET_CLASSES.map((assetClass) => [
      assetClass,
      { min: ranges[assetClass].min, max: ranges[assetClass].max },
    ])
  ) as TargetRanges
}

function sumOf(
  classes: readonly TargetAssetClass[],
  ranges: TargetRanges,
  bound: 'min' | 'max'
) {
  return classes.reduce(
    (total, assetClass) => total.plus(ranges[assetClass][bound]),
    new Decimal(0)
  )
}
