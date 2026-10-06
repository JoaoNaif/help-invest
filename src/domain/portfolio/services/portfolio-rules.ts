import Decimal from 'decimal.js'
import { Alert } from '@/domain/shared/alert'
import {
  FGC_LIMIT_PER_ISSUER,
  isCoveredByFgc,
} from '@/domain/shared/constants/fgc'
import { AlertSeverity } from '@/domain/shared/enums/alert-severity'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { formatBRL, formatPercent } from '@/domain/shared/format'
import { InvestorProfile } from '../entities/investor-profile'
import { Position } from '../entities/position'

/** Regra do produto (não é norma): % máximo da carteira em um único emissor. */
export const ISSUER_CONCENTRATION_LIMIT_PERCENT = new Decimal(20)

/** Regra do produto (não é norma): reserva mínima, em meses de renda. */
export const EMERGENCY_RESERVE_MONTHS = 6

export interface AllocationItem<K> {
  key: K
  amount: Decimal
  /** Em pontos percentuais (0–100), sem arredondamento. */
  percentage: Decimal
}

export interface IssuerExposure {
  issuerCnpj: string
  issuerName: string | null
  amount: Decimal
  percentage: Decimal
  /** Soma só dos produtos cobertos pelo FGC (CDB, LCI, LCA, LC). */
  fgcCoveredAmount: Decimal
  /** Quanto passa do limite do FGC (zero se não passa). */
  fgcUncoveredAmount: Decimal
}

export interface PortfolioSummary {
  total: Decimal
  byAssetType: AllocationItem<AssetType>[]
  /** `key: null` = posições sem indexador (ex.: ações, FIIs). */
  byIndexer: AllocationItem<Indexer | null>[]
  /** Só posições com CNPJ do emissor informado. */
  byIssuer: IssuerExposure[]
  alerts: Alert[]
}

/**
 * Cálculos da carteira — puro, sem banco nem LLM.
 * Ver docs/08-casos-de-uso.md#serviços-de-domínio-motor-de-regras
 */
export class PortfolioRules {
  static summarize(
    positions: Position[],
    profile: InvestorProfile | null,
    now = new Date()
  ): PortfolioSummary {
    const total = sum(positions.map((position) => position.investedAmount))
    const byIssuer = PortfolioRules.issuerExposures(positions, total)

    return {
      total,
      byAssetType: allocate(positions, (p) => p.assetType, total),
      byIndexer: allocate(positions, (p) => p.indexer, total),
      byIssuer,
      alerts: [...issuerAlerts(byIssuer), ...profileAlerts(profile, now)],
    }
  }

  static issuerExposures(
    positions: Position[],
    total = sum(positions.map((position) => position.investedAmount))
  ): IssuerExposure[] {
    const groups = new Map<string, Position[]>()

    for (const position of positions) {
      if (!position.issuerCnpj) continue

      const group = groups.get(position.issuerCnpj) ?? []
      group.push(position)
      groups.set(position.issuerCnpj, group)
    }

    return [...groups.entries()]
      .map(([issuerCnpj, group]) => {
        const amount = sum(group.map((position) => position.investedAmount))
        const fgcCoveredAmount = sum(
          group
            .filter((position) => isCoveredByFgc(position.assetType))
            .map((position) => position.investedAmount)
        )

        return {
          issuerCnpj,
          issuerName:
            group.find((position) => position.issuerName)?.issuerName ?? null,
          amount,
          percentage: percentageOf(amount, total),
          fgcCoveredAmount,
          fgcUncoveredAmount: Decimal.max(
            fgcCoveredAmount.minus(FGC_LIMIT_PER_ISSUER),
            0
          ),
        }
      })
      .sort((a, b) => b.amount.comparedTo(a.amount))
  }
}

function sum(values: Decimal[]) {
  return values.reduce((acc, value) => acc.plus(value), new Decimal(0))
}

function percentageOf(amount: Decimal, total: Decimal) {
  return total.isZero() ? new Decimal(0) : amount.div(total).times(100)
}

function allocate<K>(
  positions: Position[],
  keyOf: (position: Position) => K,
  total: Decimal
): AllocationItem<K>[] {
  const amounts = new Map<K, Decimal>()

  for (const position of positions) {
    const key = keyOf(position)
    amounts.set(
      key,
      (amounts.get(key) ?? new Decimal(0)).plus(position.investedAmount)
    )
  }

  return [...amounts.entries()]
    .map(([key, amount]) => ({
      key,
      amount,
      percentage: percentageOf(amount, total),
    }))
    .sort((a, b) => b.amount.comparedTo(a.amount))
}

function issuerLabel(exposure: IssuerExposure) {
  return exposure.issuerName
    ? `${exposure.issuerName} (CNPJ ${exposure.issuerCnpj})`
    : `CNPJ ${exposure.issuerCnpj}`
}

function issuerAlerts(byIssuer: IssuerExposure[]): Alert[] {
  const alerts: Alert[] = []

  for (const exposure of byIssuer) {
    if (exposure.fgcUncoveredAmount.greaterThan(0)) {
      alerts.push({
        code: 'ABOVE_FGC_LIMIT',
        severity: AlertSeverity.DANGER,
        message:
          `Você tem ${formatBRL(exposure.fgcCoveredAmount)} em produtos cobertos pelo FGC ` +
          `em ${issuerLabel(exposure)}. O FGC cobre até ${formatBRL(FGC_LIMIT_PER_ISSUER)} ` +
          `por CPF por instituição: ${formatBRL(exposure.fgcUncoveredAmount)} estão sem garantia.`,
      })
    }

    if (exposure.percentage.greaterThan(ISSUER_CONCENTRATION_LIMIT_PERCENT)) {
      alerts.push({
        code: 'ISSUER_CONCENTRATION',
        severity: AlertSeverity.WARNING,
        message:
          `${issuerLabel(exposure)} concentra ${formatPercent(exposure.percentage)} ` +
          `da sua carteira (limite sugerido: ${formatPercent(ISSUER_CONCENTRATION_LIMIT_PERCENT)}).`,
      })
    }
  }

  return alerts
}

function profileAlerts(profile: InvestorProfile | null, now: Date): Alert[] {
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

  if (profile.isOutdated(now)) {
    alerts.push({
      code: 'PROFILE_OUTDATED',
      severity: AlertSeverity.INFO,
      message:
        'Seu perfil não é atualizado há mais de 6 meses. Confira se renda, reserva e objetivo continuam os mesmos.',
    })
  }

  const recommendedReserve = profile.monthlyIncome.times(
    EMERGENCY_RESERVE_MONTHS
  )

  if (profile.emergencyReserve.lessThan(recommendedReserve)) {
    alerts.push({
      code: 'LOW_EMERGENCY_RESERVE',
      severity: AlertSeverity.WARNING,
      message:
        `Sua reserva de emergência (${formatBRL(profile.emergencyReserve)}) cobre menos de ` +
        `${EMERGENCY_RESERVE_MONTHS} meses da sua renda. Recomendado: ${formatBRL(recommendedReserve)}.`,
    })
  }

  return alerts
}
