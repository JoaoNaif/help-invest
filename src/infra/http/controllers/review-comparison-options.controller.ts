import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Put,
  UnprocessableEntityException,
} from '@nestjs/common'
import { z } from 'zod'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { InvalidComparisonStatusError } from '@/domain/comparison/applications/errors/invalid-comparison-status-error'
import { NoOptionsFoundError } from '@/domain/comparison/applications/errors/no-options-found-error'
import { ReviewComparisonOptionsUseCase } from '@/domain/comparison/applications/use-cases/review-comparison-options'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { ComparisonPresenter } from '../presenters/comparison-presenter'
import { uuidParamSchema } from '../schemas/common'
import {
  MAX_COMPARISON_OPTIONS,
  comparisonOptionInputSchema,
} from '../schemas/comparison-option'

// Lista completa já corrigida: com `id` edita · sem `id` cria · ausente remove.
const reviewComparisonOptionsBodySchema = z.object({
  options: z
    .array(comparisonOptionInputSchema.extend({ id: z.string().uuid().optional() }))
    .min(1)
    .max(MAX_COMPARISON_OPTIONS),
})

type ReviewComparisonOptionsBodySchema = z.infer<
  typeof reviewComparisonOptionsBodySchema
>

/** UC-15 — PUT /comparisons/:id/options (só em DRAFT) */
@Controller('comparisons/:id/options')
export class ReviewComparisonOptionsController {
  constructor(private reviewOptions: ReviewComparisonOptionsUseCase) {}

  @Put()
  async handle(
    @CurrentUser() user: UserPayload,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(reviewComparisonOptionsBodySchema))
    body: ReviewComparisonOptionsBodySchema
  ) {
    const result = await this.reviewOptions.execute({
      userId: user.sub,
      comparisonId: id,
      options: body.options,
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
        case NoOptionsFoundError:
          throw new UnprocessableEntityException(error.message)
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
