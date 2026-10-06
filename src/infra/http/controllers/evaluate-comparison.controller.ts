import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { IndicatorUnavailableError } from '@/domain/comparison/applications/errors/indicator-unavailable-error'
import { InvalidComparisonStatusError } from '@/domain/comparison/applications/errors/invalid-comparison-status-error'
import { UnsupportedAssetTypeError } from '@/domain/comparison/applications/errors/unsupported-asset-type-error'
import { EvaluateComparisonUseCase } from '@/domain/comparison/applications/use-cases/evaluate-comparison'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { ComparisonPresenter } from '../presenters/comparison-presenter'
import { uuidParamSchema } from '../schemas/common'

/** UC-16 — POST /comparisons/:id/evaluate (roda o motor de regras) */
@Controller('comparisons/:id/evaluate')
export class EvaluateComparisonController {
  constructor(private evaluateComparison: EvaluateComparisonUseCase) {}

  @Post()
  @HttpCode(200)
  async handle(
    @CurrentUser() user: UserPayload,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string
  ) {
    const result = await this.evaluateComparison.execute({
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
        case InvalidComparisonStatusError:
          throw new ConflictException(error.message)
        case UnsupportedAssetTypeError:
          throw new UnprocessableEntityException(error.message)
        case IndicatorUnavailableError:
          throw new ServiceUnavailableException(error.message)
        default:
          throw new BadRequestException(error.message)
      }
    }

    return {
      comparison: ComparisonPresenter.toHTTP(result.value.comparison),
      options: result.value.options.map(ComparisonPresenter.optionToHTTP),
    }
  }
}
