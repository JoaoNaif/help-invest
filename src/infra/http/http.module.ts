import Anthropic from '@anthropic-ai/sdk'
import { Module } from '@nestjs/common'
import { LlmGateway } from '@/domain/comparison/applications/gateways/llm-gateway'
import { DatabaseModule } from '../database/database.module'
import { CryptographyModule } from '../cryptography/cryptography.module'
import { EnvModule } from '../env/env.module'
import { EnvService } from '../env/env.service'
import { AnthropicLlmGateway } from '../gateways/anthropic-llm-gateway'
import { UnavailableLlmGateway } from '../gateways/unavailable-llm-gateway'
import { AuthenticateController } from './controllers/authenticate.controller'
import { ChooseComparisonOptionController } from './controllers/choose-comparison-option.controller'
import { CreateComparisonController } from './controllers/create-comparison.controller'
import { CreatePositionController } from './controllers/create-position.controller'
import { DeletePositionController } from './controllers/delete-position.controller'
import { EditPositionController } from './controllers/edit-position.controller'
import { EvaluateComparisonController } from './controllers/evaluate-comparison.controller'
import { ExplainComparisonController } from './controllers/explain-comparison.controller'
import { GetComparisonController } from './controllers/get-comparison.controller'
import { GetCurrentUserController } from './controllers/get-current-user.controller'
import { GetInvestorProfileController } from './controllers/get-investor-profile.controller'
import { GetPortfolioSummaryController } from './controllers/get-portfolio-summary.controller'
import { HealthController } from './controllers/health.controller'
import { ListComparisonsController } from './controllers/list-comparisons.controller'
import { ListRecentComparisonOptionsController } from './controllers/list-recent-comparison-options.controller'
import { ListPositionsController } from './controllers/list-positions.controller'
import { LogoutController } from './controllers/logout.controller'
import { RefreshSessionController } from './controllers/refresh-session.controller'
import { RegisterUserController } from './controllers/register-user.controller'
import { ReviewComparisonOptionsController } from './controllers/review-comparison-options.controller'
import { SaveInvestorProfileController } from './controllers/save-investor-profile.controller'
import { accountsUseCases } from './use-cases/accounts.providers'
import { comparisonUseCases } from './use-cases/comparison.providers'
import { portfolioUseCases } from './use-cases/portfolio.providers'

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
    ...accountsUseCases,
    ...portfolioUseCases,
    ...comparisonUseCases,
  ],
})
export class HttpModule {}
