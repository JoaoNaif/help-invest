import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'
import { AssetClass } from '../../entities/enums/asset-class'
import { PortfolioStrategy } from '../../entities/enums/portfolio-strategy'
import {
  AssetClassTarget,
  MarketContext,
  PortfolioPath,
} from './portfolio-analysis-report'

/**
 * O que o LLM recebe. Minimização (LGPD): só percentuais — sem valores em
 * reais, renda, reserva em reais, emissor ou CNPJ. Alertas vão só com código
 * e severidade porque o texto deles cita emissor, CNPJ e valores.
 */
export interface PortfolioExplanationInput {
  strategy: PortfolioStrategy
  investor: {
    riskTolerance: RiskTolerance
    horizonMonths: number
    goal: InvestmentGoal | null
    /** `true` = sem perfil preenchido; valem as premissas padrão. */
    isDefault: boolean
  }
  current: { assetClass: AssetClass; percentage: string }[]
  target: AssetClassTarget[]
  paths: PortfolioPath[]
  market: MarketContext
  /** `null` = reserva desconhecida (sem perfil). */
  reserveIsBelowRecommended: boolean | null
  alerts: { code: string; severity: string }[]
}
