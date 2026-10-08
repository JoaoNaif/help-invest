import { Controller, Get, Query } from '@nestjs/common'
import { z } from 'zod'
import { ListComparisonsUseCase } from '@/domain/comparison/applications/use-cases/list-comparisons'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { ComparisonPresenter } from '../presenters/comparison-presenter'

const listComparisonsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

type ListComparisonsQuerySchema = z.infer<typeof listComparisonsQuerySchema>

/** UC-20 — GET /comparisons?page=1 */
@Controller('comparisons')
export class ListComparisonsController {
  constructor(private listComparisons: ListComparisonsUseCase) {}

  @Get()
  async handle(
    @CurrentUser() user: UserPayload,
    @Query(new ZodValidationPipe(listComparisonsQuerySchema))
    query: ListComparisonsQuerySchema
  ) {
    const result = await this.listComparisons.execute({
      userId: user.sub,
      page: query.page,
    })

    return {
      comparisons: result.value.comparisons.map(ComparisonPresenter.summaryToHTTP),
    }
  }
}
