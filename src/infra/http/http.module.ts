import Anthropic from '@anthropic-ai/sdk'
import { Module } from '@nestjs/common'
import { LlmGateway } from '@/domain/comparison/applications/gateways/llm-gateway'
import { MarketIndexProvider } from '@/domain/market-overview/applications/gateways/market-index-provider'
import { StockDataProvider } from '@/domain/stock-analysis/applications/gateways/stock-data-provider'
import { DatabaseModule } from '../database/database.module'
import { CryptographyModule } from '../cryptography/cryptography.module'
import { EnvModule } from '../env/env.module'
import { EnvService } from '../env/env.service'
import { AnthropicLlmGateway } from '../gateways/anthropic-llm-gateway'
import { UnavailableLlmGateway } from '../gateways/unavailable-llm-gateway'
import { YahooMarketIndexProvider } from '../gateways/yahoo-market-index-provider'
import { YahooStockDataProvider } from '../gateways/yahoo-stock-data-provider'
import { AuthenticateController } from './controllers/authenticate.controller'
import { ChooseComparisonOptionController } from './controllers/choose-comparison-option.controller'
import { CreateComparisonController } from './controllers/create-comparison.controller'
import { CreatePortfolioAnalysisController } from './controllers/create-portfolio-analysis.controller'
import { CreatePositionController } from './controllers/create-position.controller'
import { CreateStockAnalysisController } from './controllers/create-stock-analysis.controller'
import { DeletePositionController } from './controllers/delete-position.controller'
import { EditPositionController } from './controllers/edit-position.controller'
import { EvaluateComparisonController } from './controllers/evaluate-comparison.controller'
import { ExplainComparisonController } from './controllers/explain-comparison.controller'
import { ExplainPortfolioAnalysisController } from './controllers/explain-portfolio-analysis.controller'
import { GetComparisonController } from './controllers/get-comparison.controller'
import { GetCurrentUserController } from './controllers/get-current-user.controller'
import { GetInvestorProfileController } from './controllers/get-investor-profile.controller'
import { GetMarketOverviewController } from './controllers/get-market-overview.controller'
import { GetPortfolioAnalysisController } from './controllers/get-portfolio-analysis.controller'
import { GetPortfolioSummaryController } from './controllers/get-portfolio-summary.controller'
import { GetStockAnalysisController } from './controllers/get-stock-analysis.controller'
import { HealthController } from './controllers/health.controller'
import { ListComparisonsController } from './controllers/list-comparisons.controller'
import { ListRecentComparisonOptionsController } from './controllers/list-recent-comparison-options.controller'
import { ListPortfolioAnalysesController } from './controllers/list-portfolio-analyses.controller'
import { ListPositionsController } from './controllers/list-positions.controller'
import { ListStockAnalysesController } from './controllers/list-stock-analyses.controller'
import { LogoutController } from './controllers/logout.controller'
import { RefreshSessionController } from './controllers/refresh-session.controller'
import { RegisterUserController } from './controllers/register-user.controller'
import { ReviewComparisonOptionsController } from './controllers/review-comparison-options.controller'
import { SaveInvestorProfileController } from './controllers/save-investor-profile.controller'
import { accountsUseCases } from './use-cases/accounts.providers'
import { comparisonUseCases } from './use-cases/comparison.providers'
import { marketOverviewUseCases } from './use-cases/market-overview.providers'
import { portfolioAnalysisUseCases } from './use-cases/portfolio-analysis.providers'
import { portfolioUseCases } from './use-cases/portfolio.providers'
import { stockAnalysisUseCases } from './use-cases/stock-analysis.providers'

// Controllers e use-cases (providers) de cada contexto entram aqui.
@Module({
  imports: [DatabaseModule, CryptographyModule, EnvModule],
  controllers: [
    HealthController,
    // accounts
    RegisterUserController,
    AuthenticateController,
    RefreshSessionController,
    LogoutController,
    GetCurrentUserController,
    // portfolio
    SaveInvestorProfileController,
    GetInvestorProfileController,
    CreatePositionController,
    EditPositionController,
    DeletePositionController,
    ListPositionsController,
    GetPortfolioSummaryController,
    // comparison
    CreateComparisonController,
    ReviewComparisonOptionsController,
    EvaluateComparisonController,
    ExplainComparisonController,
    ChooseComparisonOptionController,
    GetComparisonController,
    ListComparisonsController,
    ListRecentComparisonOptionsController,
    // stock-analysis
    CreateStockAnalysisController,
    GetStockAnalysisController,
    ListStockAnalysesController,
    // portfolio-analysis
    CreatePortfolioAnalysisController,
    GetPortfolioAnalysisController,
    ListPortfolioAnalysesController,
    ExplainPortfolioAnalysisController,
    // market-overview
    GetMarketOverviewController,
  ],
  providers: [
    // Sem ANTHROPIC_API_KEY o LLM fica indisponível (503) e só a comparação
    // manual funciona.
    {
      provide: LlmGateway,
      inject: [EnvService],
      useFactory: (env: EnvService): LlmGateway => {
        const apiKey = env.get('ANTHROPIC_API_KEY')

        return apiKey
          ? new AnthropicLlmGateway(
              new Anthropic({ apiKey }),
              env.get('ANTHROPIC_MODEL')
            )
          : new UnavailableLlmGateway()
      },
    },
    // Uma instância só: guarda a sessão (cookie + crumb) do Yahoo entre chamadas.
    {
      provide: StockDataProvider,
      useFactory: (): StockDataProvider => new YahooStockDataProvider(),
    },
    // Uma instância só: o cache (1 h) vive nela.
    {
      provide: MarketIndexProvider,
      useFactory: (): MarketIndexProvider => new YahooMarketIndexProvider(),
    },
    ...accountsUseCases,
    ...portfolioUseCases,
    ...comparisonUseCases,
    ...stockAnalysisUseCases,
    ...portfolioAnalysisUseCases,
    ...marketOverviewUseCases,
  ],
})
export class HttpModule {}
