import { Controller, Get } from '@nestjs/common'
import { GetPortfolioSummaryUseCase } from '@/domain/portfolio/applications/use-cases/get-portfolio-summary'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { PortfolioSummaryPresenter } from '../presenters/portfolio-summary-presenter'

/** UC-12 — GET /portfolio/summary */
@Controller('portfolio/summary')
export class GetPortfolioSummaryController {
  constructor(private getPortfolioSummary: GetPortfolioSummaryUseCase) {}

  @Get()
  async handle(@CurrentUser() user: UserPayload) {
    const result = await this.getPortfolioSummary.execute({ userId: user.sub })

    return { summary: PortfolioSummaryPresenter.toHTTP(result.value) }
  }
}
