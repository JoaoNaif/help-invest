import { IndexTrendDirection } from '../../services/index-trend'
import { SelicTrend } from '@/domain/portfolio-analysis/entities/enums/selic-trend'
import { Alert } from '@/domain/shared/alert'
import { ReadingTopic } from '../../entities/enums/reading-topic'
import { Stance } from '../../entities/enums/stance'

/** Código estável + texto em pt-BR, ambos vindos do motor. */
export interface OverviewNote {
  code: string
  message: string
}

export interface RateValue {
  /** % a.a. (IPCA 12m: acumulado), 2 casas. */
  value: string
  /** Data da leitura (YYYY-MM-DD). */
  asOf: string
}

export interface MarketReadingItem {
  topic: ReadingTopic
  stance: Stance
  /** Sempre ao menos um, com os números usados. */
  reasons: OverviewNote[]
  /** Limiares e regras de que a leitura depende. */
  premises: OverviewNote[]
}

export interface TaxExemptBracket {
  label: string
  /** Alíquota do IR em %, 2 casas. */
  incomeTaxRate: string
  /** % do CDI que um título tributado precisa pagar para render o mesmo. */
  equivalentTaxedPercentOfCdi: string
}

export interface TaxExemptEquivalence {
  kind: 'TAX_EXEMPT_VS_TAXED'
  exemptPercentOfCdi: string
  brackets: TaxExemptBracket[]
  note: string
}

/** Tendência descritiva (não preditiva) de um índice. */
export interface IndexReading {
  /** Data da última cotação (YYYY-MM-DD). */
  asOf: string
  source: string
  /** % em 12 meses, 2 casas. */
  return12m: string
  /** % acima (+) ou abaixo (−) da média de 200 dias, 2 casas. */
  vsMovingAverage200: string
  trend: IndexTrendDirection
}

/** `null` = a fonte não expõe o índice (ou está fora do ar): vem com alerta. */
export interface MarketIndices {
  ibovespa: IndexReading | null
  ifix: IndexReading | null
}

/** Leitura do mercado de hoje, calculada na hora (não é snapshot). */
export interface MarketOverview {
  generatedAt: string
  rates: {
    selic: RateValue | null
    cdi: RateValue | null
    ipca12m: RateValue | null
    realRate: { value: string } | null
    selicTrend: SelicTrend | null
  }
  history: {
    /** Um ponto por mês (último valor do mês), até 12 meses, do mais antigo ao mais novo. */
    selic: { date: string; value: string }[]
    ipcaMonthly: { month: string; value: string }[]
  }
  readings: MarketReadingItem[]
  equivalences: TaxExemptEquivalence[]
  market: MarketIndices
  alerts: Alert[]
  assumptions: Record<string, unknown>
}
