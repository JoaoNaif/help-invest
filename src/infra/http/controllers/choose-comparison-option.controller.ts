import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common'
import { z } from 'zod'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { InvalidComparisonStatusError } from '@/domain/comparison/applications/errors/invalid-comparison-status-error'
import { ChooseComparisonOptionUseCase } from '@/domain/comparison/applications/use-cases/choose-comparison-option'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { ComparisonPresenter } from '../presenters/comparison-presenter'
import { uuidParamSchema } from '../schemas/common'

const chooseComparisonOptionBodySchema = z.object({
  optionId: z.string().uuid(),
})

type ChooseComparisonOptionBodySchema = z.infer<
  typeof chooseComparisonOptionBodySchema
>

/** UC-18 — PUT /comparisons/:id/chosen-option (pode trocar a escolha) */
@Controller('comparisons/:id/chosen-option')
export class ChooseComparisonOptionController {
  constructor(private chooseOption: ChooseComparisonOptionUseCase) {}

  @Put()
  async handle(
    @CurrentUser() user: UserPayload,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(chooseComparisonOptionBodySchema))
    body: ChooseComparisonOptionBodySchema
  ) {
    const result = await this.chooseOption.execute({
      userId: user.sub,
      comparisonId: id,
      optionId: body.optionId,
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
        default:
          throw new BadRequestException(error.message)
      }
    }

    return { comparison: ComparisonPresenter.toHTTP(result.value.comparison) }
  }
}
