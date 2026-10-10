import { Controller, Get, Query } from '@nestjs/common'
import { z } from 'zod'
import { ListStockAnalysesUseCase } from '@/domain/stock-analysis/applications/use-cases/list-stock-analyses'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { StockAnalysisPresenter } from '../presenters/stock-analysis-presenter'

const listStockAnalysesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

type ListStockAnalysesQuerySchema = z.infer<typeof listStockAnalysesQuerySchema>

/** GET /stock-analyses?page=1 */
@Controller('stock-analyses')
export class ListStockAnalysesController {
  constructor(private listStockAnalyses: ListStockAnalysesUseCase) {}

  @Get()
  async handle(
    @CurrentUser() user: UserPayload,
    @Query(new ZodValidationPipe(listStockAnalysesQuerySchema))
    query: ListStockAnalysesQuerySchema
  ) {
    const result = await this.listStockAnalyses.execute({
      userId: user.sub,
      page: query.page,
    })

    return {
      analyses: result.value.analyses.map(StockAnalysisPresenter.toHTTP),
    }
  }
}
