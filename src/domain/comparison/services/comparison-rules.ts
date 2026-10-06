import Decimal from 'decimal.js'
import { InvestorProfile } from '@/domain/portfolio/entities/investor-profile'
import {
  EMERGENCY_RESERVE_MONTHS,
  ISSUER_CONCENTRATION_LIMIT_PERCENT,
  IssuerExposure,
} from '@/domain/portfolio/services/portfolio-rules'
import { Alert } from '@/domain/shared/alert'
import {
  FGC_LIMIT_PER_ISSUER,
  isCoveredByFgc,
} from '@/domain/shared/constants/fgc'
import { IOF_FREE_AFTER_DAYS } from '@/domain/shared/constants/income-tax'
import { AlertSeverity } from '@/domain/shared/enums/alert-severity'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import { formatBRL, formatPercent } from '@/domain/shared/format'
import { ComparisonOption } from '../entities/comparison-option'

/**
 * Regra do produto (não é norma): taxa bruta acima deste % do CDI é sinal de
 * risco do emissor, não de oportunidade.
 */
export const RATE_ABOVE_MARKET_CDI_PERCENT = new Decimal(130)

export interface ComparisonContext {
  /** Valor que o usuário pretende aplicar. */
  amount: Decimal
  now: Date
  /** Data em que o usuário vai precisar do dinheiro. */
  horizonEnd: Date
  /** CDI de referência, % a.a. */
  cdi: Decimal
  profile: InvestorProfile | null
  portfolio: { total: Decimal; byIssuer: IssuerExposure[] }
}

export interface OptionFigures {
  grossAnnualRate: Decimal
  holdingDays: number
}

/**
 * Alertas de cada opção, cruzando com carteira e perfil — puro, sem banco
 * nem LLM. Ver docs/08-casos-de-uso.md#uc-16--evaluatecomparison
 */
export class ComparisonRules {
  static alertsFor(
    option: ComparisonOption,
    figures: OptionFigures,
    context: ComparisonContext
  ): Alert[] {
    return [
      ...maturityAlerts(option, context),
      ...protectionAlerts(option, context),
      ...liquidityAlerts(option, context),
      ...rateAlerts(figures, context),
      ...amountAlerts(option, figures, context),
    ]
  }
}

function existingExposure(
  option: ComparisonOption,
  context: ComparisonContext
) {
  return context.portfolio.byIssuer.find(
    (exposure) => exposure.issuerCnpj === option.issuerCnpj
  )
}

function maturityAlerts(
  option: ComparisonOption,
  context: ComparisonContext
): Alert[] {
  const alerts: Alert[] = []

  if (!option.maturityAt) return alerts

  if (option.maturityAt.getTime() <= context.now.getTime()) {
    alerts.push({
      code: 'MATURITY_IN_PAST',
      severity: AlertSeverity.DANGER,
      message:
        'O vencimento informado já passou. Confira a data; o cálculo usou o seu horizonte.',
    })
  } else if (
    option.maturityAt.getTime() > context.horizonEnd.getTime() &&
    option.liquidity !== Liquidity.DAILY
  ) {
    alerts.push({
      code: 'MATURITY_AFTER_HORIZON',
      severity: AlertSeverity.WARNING,
      message:
        'Vence depois de quando você disse que vai precisar do dinheiro. ' +
        'Resgatar antes pode não ser possível ou sair com perda.',
    })
  }

  return alerts
}

function protectionAlerts(
  option: ComparisonOption,
  context: ComparisonContext
): Alert[] {
  const alerts: Alert[] = []

  if (!isCoveredByFgc(option.assetType)) {
    // Tesouro não tem FGC, mas é garantido pelo Tesouro Nacional.
    if (option.assetType !== AssetType.TESOURO) {
      alerts.push({
        code: 'NO_FGC_COVERAGE',
        severity: AlertSeverity.WARNING,
        message:
          'Este produto não tem garantia do FGC: se o emissor quebrar, você pode perder o dinheiro.',
      })
    }

    return alerts
  }

  if (!option.issuerCnpj) {
    alerts.push({
      code: 'ISSUER_CNPJ_MISSING',
      severity: AlertSeverity.INFO,
      message:
        'Sem o CNPJ do emissor não dá para checar o limite do FGC nem a sua concentração nele.',
    })

    return alerts
  }

  const alreadyCovered =
    existingExposure(option, context)?.fgcCoveredAmount ?? new Decimal(0)
  const coveredAfter = alreadyCovered.plus(context.amount)

  if (coveredAfter.greaterThan(FGC_LIMIT_PER_ISSUER)) {
    alerts.push({
      code: 'ABOVE_FGC_LIMIT',
      severity: AlertSeverity.DANGER,
      message:
        `Somando o que você já tem nesse emissor (${formatBRL(alreadyCovered)}), ficaria com ` +
        `${formatBRL(coveredAfter)} cobertos pelo FGC, que garante até ` +
        `${formatBRL(FGC_LIMIT_PER_ISSUER)}: ${formatBRL(coveredAfter.minus(FGC_LIMIT_PER_ISSUER))} sem garantia.`,
    })
  }

  return alerts
}

function liquidityAlerts(
  option: ComparisonOption,
  context: ComparisonContext
): Alert[] {
  const alerts: Alert[] = []

  if (option.graceDays && option.graceDays > 0) {
    alerts.push({
      code: 'GRACE_PERIOD',
      severity: AlertSeverity.WARNING,
      message: `Tem carência: o resgate só é possível depois de ${option.graceDays} dias.`,
    })
  }

  const isIlliquid =
    option.liquidity === Liquidity.AT_MATURITY ||
    option.liquidity === Liquidity.GRACE_PERIOD

  if (isIlliquid && context.profile) {
    const recommendedReserve = context.profile.monthlyIncome.times(
      EMERGENCY_RESERVE_MONTHS
    )

    if (context.profile.emergencyReserve.lessThan(recommendedReserve)) {
      alerts.push({
        code: 'LOW_LIQUIDITY_NO_RESERVE',
        severity: AlertSeverity.WARNING,
        message:
          'O dinheiro fica preso e sua reserva de emergência está abaixo do recomendado. ' +
          'Considere completar a reserva antes, em algo com liquidez diária.',
      })
    }
  }

  return alerts
}

function rateAlerts(
  figures: OptionFigures,
  context: ComparisonContext
): Alert[] {
  const threshold = context.cdi.times(RATE_ABOVE_MARKET_CDI_PERCENT).div(100)

  if (!figures.grossAnnualRate.greaterThan(threshold)) return []

  return [
    {
      code: 'RATE_ABOVE_MARKET',
      severity: AlertSeverity.WARNING,
      message:
        `Taxa bruta de ${formatPercent(figures.grossAnnualRate, 2)} a.a. está acima de ` +
        `${formatPercent(RATE_ABOVE_MARKET_CDI_PERCENT, 0)} do CDI. Taxa muito alta costuma ` +
        'indicar emissor mais arriscado: é risco, não oportunidade.',
    },
  ]
}

function amountAlerts(
  option: ComparisonOption,
  figures: OptionFigures,
  context: ComparisonContext
): Alert[] {
  const alerts: Alert[] = []

  if (option.minAmount && context.amount.lessThan(option.minAmount)) {
    alerts.push({
      code: 'BELOW_MIN_AMOUNT',
      severity: AlertSeverity.WARNING,
      message: `A aplicação mínima é ${formatBRL(option.minAmount)}, acima do valor que você quer aplicar.`,
    })
  }

  if (option.issuerCnpj) {
    const existing = existingExposure(option, context)?.amount ?? new Decimal(0)
    const totalAfter = context.portfolio.total.plus(context.amount)
    const shareAfter = existing.plus(context.amount).div(totalAfter).times(100)

    if (shareAfter.greaterThan(ISSUER_CONCENTRATION_LIMIT_PERCENT)) {
      alerts.push({
        code: 'ISSUER_CONCENTRATION',
        severity: AlertSeverity.WARNING,
        message:
          `Depois dessa aplicação, esse emissor ficaria com ${formatPercent(shareAfter)} da sua ` +
          `carteira (limite sugerido: ${formatPercent(ISSUER_CONCENTRATION_LIMIT_PERCENT)}).`,
      })
    }
  }

  if (figures.holdingDays < IOF_FREE_AFTER_DAYS) {
    alerts.push({
      code: 'SHORT_TERM_IOF',
      severity: AlertSeverity.INFO,
      message: `Prazo menor que ${IOF_FREE_AFTER_DAYS} dias: há IOF sobre o rendimento, que não entrou na conta.`,
    })
  }

  return alerts
}
