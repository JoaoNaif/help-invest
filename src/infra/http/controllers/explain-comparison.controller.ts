import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { ExplanationFailedError } from '@/domain/comparison/applications/errors/explanation-failed-error'
import { InvalidComparisonStatusError } from '@/domain/comparison/applications/errors/invalid-comparison-status-error'
import { LlmUnavailableError } from '@/domain/comparison/applications/errors/llm-unavailable-error'
import { ExplainComparisonUseCase } from '@/domain/comparison/applications/use-cases/explain-comparison'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { uuidParamSchema } from '../schemas/common'

/** UC-17 — POST /comparisons/:id/explanation (o LLM só redige) */
@Controller('comparisons/:id/explanation')
export class ExplainComparisonController {
  constructor(private explainComparison: ExplainComparisonUseCase) {}

  @Post()
  @HttpCode(200)
  // Cada chamada custa uma ida ao LLM.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async handle(
    @CurrentUser() user: UserPayload,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string
  ) {
    const result = await this.explainComparison.execute({
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
        case LlmUnavailableError:
          throw new ServiceUnavailableException(error.message)
        case ExplanationFailedError:
          throw new BadGatewayException(error.message)
        default:
          throw new BadRequestException(error.message)
      }
    }

    return { explanation: result.value.explanation }
  }
}
