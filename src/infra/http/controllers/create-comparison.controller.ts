import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { z } from 'zod'
import { ExtractionFailedError } from '@/domain/comparison/applications/errors/extraction-failed-error'
import { LlmUnavailableError } from '@/domain/comparison/applications/errors/llm-unavailable-error'
import { NoOptionsFoundError } from '@/domain/comparison/applications/errors/no-options-found-error'
import { CreateComparisonUseCase } from '@/domain/comparison/applications/use-cases/create-comparison'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { ComparisonPresenter } from '../presenters/comparison-presenter'
import { positiveDecimalSchema } from '../schemas/common'
import {
  MAX_COMPARISON_OPTIONS,
  comparisonOptionInputSchema,
} from '../schemas/comparison-option'

// A API do LLM aceita imagens de até 5 MB (~6,7 milhões de caracteres em base64).
const MAX_IMAGE_BASE64_LENGTH = 7_000_000
const MAX_TEXT_LENGTH = 20_000

const createComparisonBodySchema = z.object({
  amount: positiveDecimalSchema,
  horizonMonths: z.number().int().positive(),
  input: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('manual'),
      options: z
        .array(comparisonOptionInputSchema)
        .min(1)
        .max(MAX_COMPARISON_OPTIONS),
    }),
    z.object({
      type: z.literal('text'),
      text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
    }),
    z.object({
      type: z.literal('image'),
      base64: z.string().min(1).max(MAX_IMAGE_BASE64_LENGTH),
      mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    }),
  ]),
})

type CreateComparisonBodySchema = z.infer<typeof createComparisonBodySchema>

/** UC-14 — POST /comparisons (nasce como DRAFT) */
@Controller('comparisons')
export class CreateComparisonController {
  constructor(private createComparison: CreateComparisonUseCase) {}

  @Post()
  @HttpCode(201)
  async handle(
    @CurrentUser() user: UserPayload,
    @Body(new ZodValidationPipe(createComparisonBodySchema))
    body: CreateComparisonBodySchema
  ) {
    const result = await this.createComparison.execute({
      userId: user.sub,
      ...body,
    })

    if (result.isLeft()) {
      const error = result.value

      switch (error.constructor) {
        case LlmUnavailableError:
          throw new ServiceUnavailableException(error.message)
        case ExtractionFailedError:
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
