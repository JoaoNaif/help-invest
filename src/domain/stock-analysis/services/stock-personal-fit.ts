import Decimal from 'decimal.js'
import { InvestorProfile } from '@/domain/portfolio/entities/investor-profile'
import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'
import { Position } from '@/domain/portfolio/entities/position'
import {
  EMERGENCY_RESERVE_MONTHS,
  ISSUER_CONCENTRATION_LIMIT_PERCENT,
} from '@/domain/portfolio/services/portfolio-rules'
import { Alert } from '@/domain/shared/alert'
import { AlertSeverity } from '@/domain/shared/enums/alert-severity'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { formatBRL, formatPercent } from '@/domain/shared/format'

/** Regra do produto (não é norma): % máximo da carteira na mesma empresa. */
export const COMPANY_CONCENTRATION_LIMIT_PERCENT =
  ISSUER_CONCENTRATION_LIMIT_PERCENT

/** Regra do produto (não é norma): % máximo da carteira num mesmo setor. */
export const SECTOR_CONCENTRATION_LIMIT_PERCENT = new Decimal(35)

/** Regra do produto (não é norma): abaixo disso, renda variável é arriscada demais. */
export const STOCK_MIN_HORIZON_MONTHS = 36

export interface TickerFitInput {
  ticker: string
  /** Quanto o usuário pretende investir nela; `null` = não informado. */
  plannedAmount: Decimal | null
  /** Tickers do setor (inclui o próprio) e o nome do setor; `null` = sem grupo. */
  group: { label: string; tickers: readonly string[] } | null
  positions: Position[]
}

/**
 * Cruza a ação com a carteira e o perfil — puro, sem banco nem LLM.
 * Posição de ação é reconhecida pelo ticker no nome (`Position` não tem campo
 * de ticker).
 */
export class StockPersonalFit {
  /** Alertas de uma ação: já tem? passa do limite? concentra o setor? */
  static tickerAlerts({
    ticker,
    plannedAmount,
    group,
    positions,
  }: TickerFitInput): Alert[] {
    const alerts: Alert[] = []
    const total = positions.reduce(
      (sum, position) => sum.plus(position.investedAmount),
      new Decimal(0)
    )
    const planned = plannedAmount ?? new Decimal(0)
    const held = heldIn(positions, [ticker])

    if (held.greaterThan(0)) {
      alerts.push({
        code: 'ALREADY_HOLDS',
        severity: AlertSeverity.INFO,
        message: `Você já tem ${formatBRL(held)} em ${ticker}.`,
      })
    }

    // Primeira aplicação: qualquer ativo seria 100% da carteira.
    if (total.isZero()) return alerts

    const totalAfter = total.plus(planned)
    const companyShare = held.plus(planned).div(totalAfter).times(100)

    if (companyShare.greaterThan(COMPANY_CONCENTRATION_LIMIT_PERCENT)) {
      alerts.push({
        code: 'COMPANY_CONCENTRATION',
        severity: AlertSeverity.WARNING,
        message:
          `${ticker} ficaria com ${formatPercent(companyShare)} da sua carteira ` +
          `(limite sugerido: ${formatPercent(COMPANY_CONCENTRATION_LIMIT_PERCENT)}).`,
      })
    }

    if (group) {
      const sectorHeld = heldIn(positions, group.tickers)
      const sectorShare = sectorHeld.plus(planned).div(totalAfter).times(100)

      if (sectorShare.greaterThan(SECTOR_CONCENTRATION_LIMIT_PERCENT)) {
        alerts.push({
          code: 'SECTOR_CONCENTRATION',
          severity: AlertSeverity.WARNING,
          message:
            `Ações de ${group.label} ficariam com ${formatPercent(sectorShare)} da sua ` +
            `carteira (limite sugerido: ${formatPercent(SECTOR_CONCENTRATION_LIMIT_PERCENT)}).`,
        })
      }
    }

    return alerts
  }

  /** Alertas do investidor, independentes de qual ação: valem para a análise toda. */
  static profileAlerts(profile: InvestorProfile | null): Alert[] {
    if (!profile) {
      return [
        {
          code: 'PROFILE_MISSING',
          severity: AlertSeverity.INFO,
          message:
            'Preencha seu perfil (renda, reserva e objetivo) para receber alertas personalizados.',
        },
      ]
    }

    const alerts: Alert[] = []
    const recommendedReserve = profile.monthlyIncome.times(
      EMERGENCY_RESERVE_MONTHS
    )

    if (profile.emergencyReserve.lessThan(recommendedReserve)) {
      alerts.push({
        code: 'LOW_RESERVE_FOR_STOCKS',
        severity: AlertSeverity.WARNING,
        message:
          'Ações oscilam e podem estar em baixa quando você precisar do dinheiro. Sua reserva de ' +
          `emergência (${formatBRL(profile.emergencyReserve)}) está abaixo do recomendado ` +
          `(${formatBRL(recommendedReserve)}): considere completá-la antes, em liquidez diária.`,
      })
    }

    if (profile.goal === InvestmentGoal.RESERVE) {
      alerts.push({
        code: 'GOAL_IS_RESERVE',
        severity: AlertSeverity.WARNING,
        message:
          'Seu objetivo é formar reserva. Reserva deve ficar em liquidez diária e baixo risco; ações não são o lugar.',
      })
    }

    if (profile.riskTolerance === RiskTolerance.LOW) {
      alerts.push({
        code: 'STOCKS_ABOVE_RISK_TOLERANCE',
        severity: AlertSeverity.WARNING,
        message:
          'Seu perfil tem baixa tolerância a risco, e ações podem cair bastante no curto prazo.',
      })
    }

    if (profile.horizonMonths < STOCK_MIN_HORIZON_MONTHS) {
      alerts.push({
        code: 'SHORT_HORIZON_FOR_STOCKS',
        severity: AlertSeverity.WARNING,
        message:
          `Seu horizonte é de ${profile.horizonMonths} meses. Para ações, o usual é pensar em ` +
          `${STOCK_MIN_HORIZON_MONTHS} meses ou mais, para atravessar oscilações.`,
      })
    }

    return alerts
  }
}

function heldIn(positions: Position[], tickers: readonly string[]) {
  return positions
    .filter(
      (position) =>
        position.assetType === AssetType.ACAO &&
        tickers.some((ticker) =>
          position.name.toUpperCase().includes(ticker.toUpperCase())
        )
    )
    .reduce(
      (sum, position) => sum.plus(position.investedAmount),
      new Decimal(0)
    )
}
