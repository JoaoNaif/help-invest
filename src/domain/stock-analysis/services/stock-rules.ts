import Decimal from 'decimal.js'
import { Alert } from '@/domain/shared/alert'
import { AlertSeverity } from '@/domain/shared/enums/alert-severity'
import { formatBRL, formatPercent } from '@/domain/shared/format'
import { StockSnapshot } from '../applications/dtos/stock-snapshot'
import { CeilingPrice } from './ceiling-price-calculator'
import { DividendAnalysis } from './dividend-analyzer'

/** Regra do produto (não é norma): cotação mais velha que isso é "desatualizada". */
export const STALE_PRICE_DAYS = 5

/**
 * Regra do produto: proventos de 12 meses abaixo deste % da média anual
 * contam como queda relevante.
 */
export const DIVIDEND_DROP_THRESHOLD_PERCENT = new Decimal(70)

/** Regra do produto: menos analistas que isso é consenso fraco. */
export const MIN_ANALYST_COVERAGE = 5

const DAY_MS = 24 * 60 * 60 * 1000

export interface StockRulesContext {
  snapshot: StockSnapshot
  dividends: DividendAnalysis
  ceilings: CeilingPrice[]
  /** Há concorrentes com múltiplos comparáveis. */
  hasPeers: boolean
  now: Date
}

/**
 * Alertas da própria ação, sem olhar para a carteira — puro, sem banco nem LLM.
 * O cruzamento com carteira e perfil fica em `StockPersonalFit`.
 */
export class StockRules {
  static alertsFor(context: StockRulesContext): Alert[] {
    return [
      ...dataAlerts(context),
      ...earningsAlerts(context),
      ...dividendAlerts(context),
      ...ceilingAlerts(context),
      ...consensusAlerts(context),
    ]
  }
}

function dataAlerts({ snapshot, hasPeers, now }: StockRulesContext): Alert[] {
  const alerts: Alert[] = []
  const ageDays = (now.getTime() - snapshot.priceDate.getTime()) / DAY_MS

  if (ageDays > STALE_PRICE_DAYS) {
    alerts.push({
      code: 'STALE_PRICE',
      severity: AlertSeverity.WARNING,
      message: `A cotação é de ${Math.floor(ageDays)} dias atrás. Confira o preço atual antes de decidir.`,
    })
  }

  if (!hasPeers) {
    alerts.push({
      code: 'NO_PEERS',
      severity: AlertSeverity.INFO,
      message:
        'Não há concorrentes cadastrados para este papel, então o valuation não foi comparado com o setor.',
    })
  }

  return alerts
}

function earningsAlerts({ snapshot }: StockRulesContext): Alert[] {
  const eps = snapshot.fundamentals.earningsPerShare

  if (eps === null || eps.greaterThan(0)) return []

  return [
    {
      code: 'NEGATIVE_EARNINGS',
      severity: AlertSeverity.WARNING,
      message:
        'A empresa está com prejuízo (lucro por ação negativo): P/L e preço teto de Graham não se aplicam.',
    },
  ]
}

function dividendAlerts({ dividends }: StockRulesContext): Alert[] {
  if (dividends.yearsCovered === 0) {
    return [
      {
        code: 'DIVIDEND_HISTORY_MISSING',
        severity: AlertSeverity.INFO,
        message:
          'Não há histórico de proventos suficiente para avaliar dividendos e o preço teto por Bazin.',
      },
    ]
  }

  if (dividends.yearsWithPayment === 0) {
    return [
      {
        code: 'NO_DIVIDENDS',
        severity: AlertSeverity.INFO,
        message: `Não pagou proventos nos últimos ${dividends.yearsCovered} anos.`,
      },
    ]
  }

  const alerts: Alert[] = []

  if (!dividends.consistent) {
    alerts.push({
      code: 'DIVIDENDS_INCONSISTENT',
      severity: AlertSeverity.WARNING,
      message:
        `Pagou proventos em ${dividends.yearsWithPayment} dos últimos ` +
        `${dividends.yearsCovered} anos: não dá para contar com renda regular.`,
    })
  }

  const average = dividends.averageAnnualPerShare

  if (
    average &&
    average.greaterThan(0) &&
    dividends.trailing12mPerShare
      .div(average)
      .times(100)
      .lessThan(DIVIDEND_DROP_THRESHOLD_PERCENT)
  ) {
    alerts.push({
      code: 'DIVIDENDS_BELOW_AVERAGE',
      severity: AlertSeverity.INFO,
      message:
        `Nos últimos 12 meses pagou ${formatBRL(dividends.trailing12mPerShare)} por ação, ` +
        `abaixo da média de ${formatBRL(average)} dos últimos ${dividends.yearsCovered} anos. ` +
        'O preço teto por Bazin usa essa média e pode estar otimista.',
    })
  }

  return alerts
}

function ceilingAlerts({ snapshot, ceilings }: StockRulesContext): Alert[] {
  if (
    ceilings.length === 0 ||
    !ceilings.every((ceiling) => ceiling.upsidePercent.lessThan(0))
  ) {
    return []
  }

  return [
    {
      code: 'ABOVE_CEILING',
      severity: AlertSeverity.WARNING,
      message:
        `O preço (${formatBRL(snapshot.price)}) está acima do preço teto por ` +
        `${ceilings.length === 1 ? 'esse método' : 'todos os métodos'}. ` +
        'É uma referência, não uma previsão, mas indica pouca margem de segurança.',
    },
  ]
}

function consensusAlerts({ snapshot }: StockRulesContext): Alert[] {
  const consensus = snapshot.consensus

  if (!consensus) {
    return [
      {
        code: 'NO_ANALYST_COVERAGE',
        severity: AlertSeverity.INFO,
        message: 'Nenhum analista cobre este papel nas fontes consultadas.',
      },
    ]
  }

  if (consensus.analystCount < MIN_ANALYST_COVERAGE) {
    return [
      {
        code: 'LOW_ANALYST_COVERAGE',
        severity: AlertSeverity.INFO,
        message:
          `Só ${consensus.analystCount} analistas cobrem este papel: ` +
          `a tendência (${formatPercent(
            new Decimal(consensus.buy).div(consensus.analystCount).times(100),
            0
          )} de compra) é pouco representativa.`,
      },
    ]
  }

  return []
}
