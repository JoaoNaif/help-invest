import { PortfolioSummary } from '@/domain/portfolio/services/portfolio-rules'

export class PortfolioSummaryPresenter {
  static toHTTP(summary: PortfolioSummary) {
    return {
      total: summary.total.toString(),
      byAssetType: summary.byAssetType.map((item) => ({
        key: item.key,
        amount: item.amount.toString(),
        percentage: item.percentage.toString(),
      })),
      byIndexer: summary.byIndexer.map((item) => ({
        key: item.key,
        amount: item.amount.toString(),
        percentage: item.percentage.toString(),
      })),
      byIssuer: summary.byIssuer.map((issuer) => ({
        issuerCnpj: issuer.issuerCnpj,
        issuerName: issuer.issuerName,
        amount: issuer.amount.toString(),
        percentage: issuer.percentage.toString(),
        fgcCoveredAmount: issuer.fgcCoveredAmount.toString(),
        fgcUncoveredAmount: issuer.fgcUncoveredAmount.toString(),
      })),
      alerts: summary.alerts,
    }
  }
}
