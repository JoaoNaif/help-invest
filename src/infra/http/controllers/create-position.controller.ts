import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { z } from 'zod'
import { CreatePositionUseCase } from '@/domain/portfolio/applications/use-cases/create-position'
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
} from '../schemas/common'

const createPositionBodySchema = z.object({
  assetType: z.nativeEnum(AssetType),
  name: z.string().trim().min(1),
  investedAmount: positiveDecimalSchema,
  issuerName: z.string().trim().min(1).nullish(),
  issuerCnpj: cnpjSchema.nullish(),
  indexer: z.nativeEnum(Indexer).nullish(),
  rate: nonNegativeDecimalSchema.nullish(),
  investedAt: dateOnlySchema.nullish(),
  maturityAt: dateOnlySchema.nullish(),
  liquidity: z.nativeEnum(Liquidity).nullish(),
})

type CreatePositionBodySchema = z.infer<typeof createPositionBodySchema>

/** UC-08 — POST /positions */
@Controller('positions')
export class CreatePositionController {
  constructor(private createPosition: CreatePositionUseCase) {}

  @Post()
  @HttpCode(201)
  async handle(
    @CurrentUser() user: UserPayload,
    @Body(new ZodValidationPipe(createPositionBodySchema))
    body: CreatePositionBodySchema
  ) {
    const result = await this.createPosition.execute({
      userId: user.sub,
      ...body,
    })

    return { position: PositionPresenter.toHTTP(result.value.position) }
  }
}
