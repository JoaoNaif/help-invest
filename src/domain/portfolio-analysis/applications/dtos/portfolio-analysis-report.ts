import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'
import { Alert } from '@/domain/shared/alert'
import { AssetClass, TargetAssetClass } from '../../entities/enums/asset-class'
import { PathDirection } from '../../entities/enums/path-direction'
import { SelicTrend } from '../../entities/enums/selic-trend'

/** Código estável + texto em pt-BR, ambos vindos do motor (nunca do LLM). */
export interface PathNote {
  code: string
  message: string
}

export interface AssetClassShare {
  assetClass: AssetClass
  /** R$, 2 casas. */
  amount: string
  /** % da carteira, 2 casas. */
  percentage: string
}

export interface AssetClassTarget {
  assetClass: TargetAssetClass
  /** % da carteira, 2 casas. */
  min: string
  max: string
}

export interface PortfolioPath {
  assetClass: TargetAssetClass
  direction: PathDirection
  currentPercentage: string
  targetMin: string
  targetMax: string
  /** Distância até a faixa (pontos percentuais); `0.00` quando dentro. */
  gapPercentage: string
  reasons: PathNote[]
  risks: PathNote[]
}

/** Reserva de emergência declarada no perfil contra 6× a renda. */
export interface ReserveStatus {
  recommended: string
  current: string
  /** Quanto falta (0.00 se completa). */
  gap: string
  isBelowRecommended: boolean
}

/** `null` = dado indisponível, nunca zero. */
export interface MarketContext {
  selic: string | null
  cdi: string | null
  ipca12m: string | null
  realRate: string | null
  selicTrend: SelicTrend | null
  /** Data da Selic/CDI usados (YYYY-MM-DD). */
  asOf: string | null
  /** Data do último IPCA mensal usado (sai com defasagem). */
  ipcaAsOf: string | null
}

export interface ProfileUsed {
  riskTolerance: RiskTolerance
  horizonMonths: number
  goal: InvestmentGoal | null
  /** `true` = sem perfil: valem MEDIUM e 60 meses. */
  isDefault: boolean
}

/** O que o motor devolve e o banco guarda (snapshot da análise). */
export interface PortfolioAnalysisReport {
  total: string
  current: AssetClassShare[]
  target: AssetClassTarget[]
  /** `null` = sem perfil, reserva desconhecida. */
  reserve: ReserveStatus | null
  paths: PortfolioPath[]
  market: MarketContext
  profileUsed: ProfileUsed
  alerts: Alert[]
}
