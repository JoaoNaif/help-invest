import Decimal from 'decimal.js'
import { formatPercent } from '@/domain/shared/format'
import { AssetClass, isVariableIncome } from '../entities/enums/asset-class'
import { SelicTrend } from '../entities/enums/selic-trend'
import { PathNote } from '../applications/dtos/portfolio-analysis-report'

/** Regra do produto (não é norma): juro real a partir do qual a renda fixa paga bem. */
export const REAL_RATE_HIGH_PERCENT = new Decimal(6)

/** Regra do produto (não é norma): juro real abaixo do qual a renda fixa paga pouco. */
export const REAL_RATE_LOW_PERCENT = new Decimal(3)

/** Janela da tendência: Selic de hoje contra a de ~6 meses atrás. */
export const SELIC_TREND_MONTHS = 6

/** Variação (pontos percentuais) que separa "estável" de subindo/caindo. */
export const SELIC_TREND_THRESHOLD_PP = new Decimal('0.5')

/** Quão atrás da data-alvo o valor histórico da Selic ainda vale (dias). */
export const SELIC_HISTORY_MAX_GAP_DAYS = 45

export const REAL_RATE_FORMULA =
  'realRate = ((1 + Selic meta a.a.) / (1 + IPCA acumulado 12m) - 1) × 100 (juro real ex-post, aproximado)'

export const SCENARIO_NOTE =
  'O cenário só desempata a ordem dos caminhos e gera motivos; ele não muda a faixa-alvo.'

export const ScenarioBias = {
  /** Juro real alto: renda fixa paga bem; renda variável na ponta baixa. */
  FAVOR_FIXED: 'FAVOR_FIXED',
  /** Juro real alto, mas Selic em queda: travar taxa real (IPCA+). */
  FAVOR_LOCK_IN: 'FAVOR_LOCK_IN',
  /** Juro real baixo ou Selic em queda: FIIs e ações ganham espaço. */
  FAVOR_VARIABLE: 'FAVOR_VARIABLE',
  NEUTRAL: 'NEUTRAL',
} as const

export type ScenarioBias = (typeof ScenarioBias)[keyof typeof ScenarioBias]

export interface ScenarioAssessment {
  bias: ScenarioBias
  /** O que disparou (para o motivo); `null` = neutro. */
  cause:
    | 'HIGH_REAL_RATE'
    | 'HIGH_REAL_RATE_FALLING_SELIC'
    | 'LOW_REAL_RATE'
    | 'FALLING_SELIC'
    | null
}

/**
 * Cenário de juros em regras simples e determinísticas. Entrada ausente
 * (`null`) faz a regra correspondente **não disparar** — nunca vira zero.
 */
export class MarketScenario {
  /** Juro real aproximado (Fisher) em %, ou `null` sem Selic ou IPCA. */
  static realRate(selic: Decimal | null, ipca12m: Decimal | null) {
    if (!selic || !ipca12m) return null

    return selic
      .div(100)
      .plus(1)
      .div(ipca12m.div(100).plus(1))
      .minus(1)
      .times(100)
  }

  /** Selic de hoje contra a de ~6 meses atrás; sem histórico = `null`. */
  static trend(current: Decimal | null, past: Decimal | null) {
    if (!current || !past) return null

    const change = current.minus(past)

    if (change.greaterThanOrEqualTo(SELIC_TREND_THRESHOLD_PP)) {
      return SelicTrend.RISING
    }

    if (change.lessThanOrEqualTo(SELIC_TREND_THRESHOLD_PP.negated())) {
      return SelicTrend.FALLING
    }

    return SelicTrend.STABLE
  }

  /**
   * Precedência (o enunciado deixava em aberto):
   * 1. juro real < 3% → favorece renda variável;
   * 2. juro real ≥ 6% e Selic caindo → trava taxa real (IPCA+), resto neutro;
   * 3. juro real ≥ 6% → favorece renda fixa;
   * 4. Selic caindo → favorece renda variável;
   * 5. senão, neutro.
   */
  static assess(
    realRate: Decimal | null,
    trend: SelicTrend | null
  ): ScenarioAssessment {
    const isFalling = trend === SelicTrend.FALLING

    if (realRate && realRate.lessThan(REAL_RATE_LOW_PERCENT)) {
      return { bias: ScenarioBias.FAVOR_VARIABLE, cause: 'LOW_REAL_RATE' }
    }

    const isHigh =
      !!realRate && realRate.greaterThanOrEqualTo(REAL_RATE_HIGH_PERCENT)

    if (isHigh && isFalling) {
      return {
        bias: ScenarioBias.FAVOR_LOCK_IN,
        cause: 'HIGH_REAL_RATE_FALLING_SELIC',
      }
    }

    if (isHigh) {
      return { bias: ScenarioBias.FAVOR_FIXED, cause: 'HIGH_REAL_RATE' }
    }

    if (isFalling) {
      return { bias: ScenarioBias.FAVOR_VARIABLE, cause: 'FALLING_SELIC' }
    }

    return { bias: ScenarioBias.NEUTRAL, cause: null }
  }

  /** +1 reforça a classe, −1 enfraquece, 0 neutro. Só desempata. */
  static effectOn(bias: ScenarioBias, assetClass: AssetClass): -1 | 0 | 1 {
    switch (bias) {
      case ScenarioBias.FAVOR_FIXED:
        if (
          assetClass === AssetClass.FIXED_POST ||
          assetClass === AssetClass.FIXED_INFLATION
        ) {
          return 1
        }

        return isVariableIncome(assetClass) ? -1 : 0
      case ScenarioBias.FAVOR_LOCK_IN:
        return assetClass === AssetClass.FIXED_INFLATION ? 1 : 0
      case ScenarioBias.FAVOR_VARIABLE:
        return assetClass === AssetClass.STOCKS ||
          assetClass === AssetClass.REAL_ESTATE_FUNDS
          ? 1
          : 0
      default:
        return 0
    }
  }

  /** Motivo em pt-BR para o caminho da classe; `null` se o cenário não a afeta. */
  static reasonFor(
    assessment: ScenarioAssessment,
    assetClass: AssetClass,
    realRate: Decimal | null
  ): PathNote | null {
    const effect = MarketScenario.effectOn(assessment.bias, assetClass)

    if (effect === 0 || !assessment.cause) return null

    const real = realRate ? formatPercent(realRate) : null

    switch (assessment.cause) {
      case 'HIGH_REAL_RATE':
        return effect > 0
          ? {
              code: 'SCENARIO_HIGH_REAL_RATE',
              message: `Com juro real em ${real} ao ano, a renda fixa está pagando bem acima da inflação.`,
            }
          : {
              code: 'SCENARIO_HIGH_REAL_RATE_VARIABLE_INCOME',
              message: `Com juro real em ${real} ao ano, a renda fixa compete bem: a renda variável pesa menos, e a ponta baixa da faixa é a mais coerente com o cenário.`,
            }
      case 'HIGH_REAL_RATE_FALLING_SELIC':
        return {
          code: 'SCENARIO_HIGH_REAL_RATE_FALLING_SELIC',
          message: `Juro real em ${real} ao ano e Selic em queda: taxas atreladas à inflação permitem fixar o ganho real por mais tempo.`,
        }
      case 'LOW_REAL_RATE':
        return {
          code: 'SCENARIO_LOW_REAL_RATE',
          message: `Com juro real em ${real} ao ano, a renda fixa paga pouco acima da inflação e a renda variável ganha espaço.`,
        }
      case 'FALLING_SELIC':
        return {
          code: 'SCENARIO_FALLING_SELIC',
          message:
            'Com a Selic em queda, a renda fixa pós-fixada tende a render menos e a renda variável ganha espaço.',
        }
    }
  }
}
