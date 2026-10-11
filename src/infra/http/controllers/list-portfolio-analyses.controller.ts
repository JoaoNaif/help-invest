import { Controller, Get, Query } from '@nestjs/common'
import { z } from 'zod'
import { ListPortfolioAnalysesUseCase } from '@/domain/portfolio-analysis/applications/use-cases/list-portfolio-analyses'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { PortfolioAnalysisPresenter } from '../presenters/portfolio-analysis-presenter'

const listPortfolioAnalysesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

type ListPortfolioAnalysesQuerySchema = z.infer<
  typeof listPortfolioAnalysesQuerySchema
>

/** GET /portfolio-analyses?page=1 */
@Controller('portfolio-analyses')
export class ListPortfolioAnalysesController {
  constructor(private listPortfolioAnalyses: ListPortfolioAnalysesUseCase) {}

  @Get()
  async handle(
    @CurrentUser() user: UserPayload,
    @Query(new ZodValidationPipe(listPortfolioAnalysesQuerySchema))
    query: ListPortfolioAnalysesQuerySchema
  ) {
    const result = await this.listPortfolioAnalyses.execute({
      userId: user.sub,
      page: query.page,
    })

    return {
      analyses: result.value.analyses.map((analysis) =>
        PortfolioAnalysisPresenter.toHTTP(analysis)
      ),
    }
  }
}
