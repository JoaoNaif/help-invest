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
import { GetComparisonUseCase } from '@/domain/comparison/applications/use-cases/get-comparison'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { ComparisonPresenter } from '../presenters/comparison-presenter'
import { uuidParamSchema } from '../schemas/common'

/** UC-19 — GET /comparisons/:id */
@Controller('comparisons/:id')
export class GetComparisonController {
  constructor(private getComparison: GetComparisonUseCase) {}

  @Get()
  async handle(
    @CurrentUser() user: UserPayload,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string
  ) {
    const result = await this.getComparison.execute({
      userId: user.sub,
      comparisonId: id,
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

    return {
      comparison: ComparisonPresenter.toHTTP(result.value.comparison),
      options: result.value.options.map(ComparisonPresenter.optionToHTTP),
      explanation: result.value.explanation,
    }
  }
}
