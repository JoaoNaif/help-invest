import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { z } from 'zod'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import { InvalidStockAnalysisRequestError } from '@/domain/stock-analysis/applications/errors/invalid-stock-analysis-request-error'
import { TickerNotFoundError } from '@/domain/stock-analysis/applications/errors/ticker-not-found-error'
import {
  CreateStockAnalysisUseCase,
  MAX_TICKERS_PER_ANALYSIS,
} from '@/domain/stock-analysis/applications/use-cases/create-stock-analysis'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { StockAnalysisPresenter } from '../presenters/stock-analysis-presenter'
import { positiveDecimalSchema } from '../schemas/common'

const createStockAnalysisBodySchema = z.object({
  items: z
    .array(
      z.object({
        ticker: z.string().trim().min(1).max(12),
        /** Quanto pretende investir nela (opcional). */
        amount: positiveDecimalSchema.nullish(),
      })
    )
    .min(1)
    .max(MAX_TICKERS_PER_ANALYSIS),
})

type CreateStockAnalysisBodySchema = z.infer<
  typeof createStockAnalysisBodySchema
>

/** POST /stock-analyses — uma ação, ou "esta com outra" (até 2) */
@Controller('stock-analyses')
export class CreateStockAnalysisController {
  constructor(private createStockAnalysis: CreateStockAnalysisUseCase) {}

  @Post()
  @HttpCode(201)
  // Cada análise consulta a fonte externa várias vezes (ação + concorrentes).
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async handle(
    @CurrentUser() user: UserPayload,
    @Body(new ZodValidationPipe(createStockAnalysisBodySchema))
    body: CreateStockAnalysisBodySchema
  ) {
    const result = await this.createStockAnalysis.execute({
      userId: user.sub,
      items: body.items,
    })

    if (result.isLeft()) {
      const error = result.value

      switch (error.constructor) {
        case TickerNotFoundError:
          throw new NotFoundException(error.message)
        case InvalidStockAnalysisRequestError:
          throw new UnprocessableEntityException(error.message)
        case MarketDataUnavailableError:
          throw new ServiceUnavailableException(error.message)
        default:
          throw new BadRequestException(error.message)
      }
    }

    return { analysis: StockAnalysisPresenter.toHTTP(result.value.analysis) }
  }
}
