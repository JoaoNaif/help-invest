import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'
import { Alert } from '@/domain/shared/alert'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'

/**
 * O que vai para o LLM explicar. Números já calculados pelo motor, como
 * **texto exato** — o LLM não faz conta nenhuma, só redige.
 * Só o necessário (LGPD): sem renda, reserva, CNPJ nem ids de usuário.
 */
export interface ExplanationOption {
  /** O LLM devolve este id para apontar a opção indicada e os prós/contras. */
  optionId: string
  /** 1 = maior taxa líquida. */
  rank: number
  assetType: AssetType
  issuerName: string | null
  indexer: Indexer
  rate: string
  maturityAt: string | null
  liquidity: Liquidity | null
  graceDays: number | null
  netAnnualRate: string
  alerts: Alert[]
}

export interface ComparisonExplanationInput {
  amount: string
  horizonMonths: number
  /** Ordenadas da maior para a menor taxa líquida. */
  options: ExplanationOption[]
  /** Premissas do cálculo (índices, prazos, alíquotas, notas). */
  assumptions: Record<string, unknown>
  /**
   * Objetivo que vale para esta explicação: o da comparação, se houver;
   * senão o do perfil. `null` = nenhum informado (indicar pela taxa líquida).
   */
  goal: InvestmentGoal | null
  investor: {
    goal: InvestmentGoal
    riskTolerance: RiskTolerance
    horizonMonths: number
  } | null
}
