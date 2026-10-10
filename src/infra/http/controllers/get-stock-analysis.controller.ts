import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { GetStockAnalysisUseCase } from '@/domain/stock-analysis/applications/use-cases/get-stock-analysis'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { StockAnalysisPresenter } from '../presenters/stock-analysis-presenter'
import { uuidParamSchema } from '../schemas/common'

/** GET /stock-analyses/:id */
@Controller('stock-analyses/:id')
export class GetStockAnalysisController {
  constructor(private getStockAnalysis: GetStockAnalysisUseCase) {}

  @Get()
  async handle(
    @CurrentUser() user: UserPayload,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string
  ) {
    const result = await this.getStockAnalysis.execute({
      userId: user.sub,
      stockAnalysisId: id,
    })

    if (result.isLeft()) {
      const error = result.value

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message)
        case NotAllowedError:
          throw new ForbiddenException(error.message)
        default:
          throw new BadRequestException(error.message)
      }
    }

    return { analysis: StockAnalysisPresenter.toHTTP(result.value.analysis) }
  }
}
