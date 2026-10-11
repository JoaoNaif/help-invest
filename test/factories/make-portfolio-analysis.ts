import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { PortfolioAnalysisReport } from '@/domain/portfolio-analysis/applications/dtos/portfolio-analysis-report'
import { PortfolioStrategy } from '@/domain/portfolio-analysis/entities/enums/portfolio-strategy'
import {
  PortfolioAnalysis,
  PortfolioAnalysisProps,
} from '@/domain/portfolio-analysis/entities/portfolio-analysis'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'

export function makePortfolioAnalysisReport(
  override: Partial<PortfolioAnalysisReport> = {}
): PortfolioAnalysisReport {
  return {
    total: '0.00',
    current: [],
    target: [],
    reserve: null,
    paths: [],
    market: {
      selic: null,
      cdi: null,
      ipca12m: null,
      realRate: null,
      selicTrend: null,
      asOf: null,
      ipcaAsOf: null,
    },
    profileUsed: {
      riskTolerance: RiskTolerance.MEDIUM,
      horizonMonths: 60,
      goal: null,
      isDefault: true,
    },
    alerts: [],
    ...override,
  }
}

export function makePortfolioAnalysis(
  override: Partial<PortfolioAnalysisProps> = {},
  id?: UniqueEntityId
) {
  return PortfolioAnalysis.create(
    {
      userId: new UniqueEntityId(),
      strategy: PortfolioStrategy.BALANCE,
      result: makePortfolioAnalysisReport(),
      assumptions: { strategy: PortfolioStrategy.BALANCE },
      ...override,
    },
    id
  )
}
