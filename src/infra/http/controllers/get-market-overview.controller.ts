import { Controller, Get, Query } from '@nestjs/common'
import { z } from 'zod'
import { GetMarketOverviewUseCase } from '@/domain/market-overview/applications/use-cases/get-market-overview'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { MarketOverviewPresenter } from '../presenters/market-overview-presenter'
import { positiveDecimalSchema } from '../schemas/common'

const getMarketOverviewQuerySchema = z.object({
  /** % do CDI de uma LCA/LCI para a equivalência com o CDB (padrão: 90). */
  exemptPercentOfCdi: positiveDecimalSchema.optional(),
})

type GetMarketOverviewQuerySchema = z.infer<typeof getMarketOverviewQuerySchema>

/** GET /market-overview — cenário de juros de hoje, independente da carteira */
@Controller('market-overview')
export class GetMarketOverviewController {
  constructor(private getMarketOverview: GetMarketOverviewUseCase) {}

  @Get()
  async handle(
    @Query(new ZodValidationPipe(getMarketOverviewQuerySchema))
    query: GetMarketOverviewQuerySchema
  ) {
    const result = await this.getMarketOverview.execute({
      exemptPercentOfCdi: query.exemptPercentOfCdi,
    })

    return { overview: MarketOverviewPresenter.toHTTP(result.value.overview) }
  }
}
