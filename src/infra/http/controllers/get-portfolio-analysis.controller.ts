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
import { GetPortfolioAnalysisUseCase } from '@/domain/portfolio-analysis/applications/use-cases/get-portfolio-analysis'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { PortfolioAnalysisPresenter } from '../presenters/portfolio-analysis-presenter'
import { uuidParamSchema } from '../schemas/common'

/** GET /portfolio-analyses/:id */
@Controller('portfolio-analyses/:id')
export class GetPortfolioAnalysisController {
  constructor(private getPortfolioAnalysis: GetPortfolioAnalysisUseCase) {}

  @Get()
  async handle(
    @CurrentUser() user: UserPayload,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string
  ) {
    const result = await this.getPortfolioAnalysis.execute({
      userId: user.sub,
      portfolioAnalysisId: id,
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

    const { analysis, explanation } = result.value

    return {
      analysis: PortfolioAnalysisPresenter.toHTTP(analysis, explanation),
    }
  }
}
