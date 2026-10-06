import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common'
import { z } from 'zod'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { EditPositionUseCase } from '@/domain/portfolio/applications/use-cases/edit-position'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { PositionPresenter } from '../presenters/position-presenter'
import {
  cnpjSchema,
  dateOnlySchema,
  nonNegativeDecimalSchema,
  positiveDecimalSchema,
  uuidParamSchema,
} from '../schemas/common'

// Campo ausente = não altera · null = limpa · valor = altera.
const editPositionBodySchema = z.object({
  assetType: z.nativeEnum(AssetType).optional(),
  name: z.string().trim().min(1).optional(),
  investedAmount: positiveDecimalSchema.optional(),
  issuerName: z.string().trim().min(1).nullable().optional(),
  issuerCnpj: cnpjSchema.nullable().optional(),
  indexer: z.nativeEnum(Indexer).nullable().optional(),
  rate: nonNegativeDecimalSchema.nullable().optional(),
  investedAt: dateOnlySchema.nullable().optional(),
  maturityAt: dateOnlySchema.nullable().optional(),
  liquidity: z.nativeEnum(Liquidity).nullable().optional(),
})

type EditPositionBodySchema = z.infer<typeof editPositionBodySchema>

/** UC-09 — PATCH /positions/:id */
@Controller('positions/:id')
export class EditPositionController {
  constructor(private editPosition: EditPositionUseCase) {}

  @Patch()
  async handle(
    @CurrentUser() user: UserPayload,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(editPositionBodySchema))
    body: EditPositionBodySchema
  ) {
    const result = await this.editPosition.execute({
      userId: user.sub,
      positionId: id,
      ...body,
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

    return { position: PositionPresenter.toHTTP(result.value.position) }
  }
}
