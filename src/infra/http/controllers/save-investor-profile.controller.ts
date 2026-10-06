import { Body, Controller, Put } from '@nestjs/common'
import { z } from 'zod'
import { SaveInvestorProfileUseCase } from '@/domain/portfolio/applications/use-cases/save-investor-profile'
import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { InvestorProfilePresenter } from '../presenters/investor-profile-presenter'
import { nonNegativeDecimalSchema } from '../schemas/common'

const saveInvestorProfileBodySchema = z.object({
  monthlyIncome: nonNegativeDecimalSchema,
  emergencyReserve: nonNegativeDecimalSchema,
  goal: z.nativeEnum(InvestmentGoal),
  horizonMonths: z.number().int().positive(),
  riskTolerance: z.nativeEnum(RiskTolerance),
})

type SaveInvestorProfileBodySchema = z.infer<
  typeof saveInvestorProfileBodySchema
>

/** UC-06 — PUT /investor-profile (cria na primeira vez, depois atualiza) */
@Controller('investor-profile')
export class SaveInvestorProfileController {
  constructor(private saveInvestorProfile: SaveInvestorProfileUseCase) {}

  @Put()
  async handle(
    @CurrentUser() user: UserPayload,
    @Body(new ZodValidationPipe(saveInvestorProfileBodySchema))
    body: SaveInvestorProfileBodySchema
  ) {
    const result = await this.saveInvestorProfile.execute({
      userId: user.sub,
      ...body,
    })

    return { profile: InvestorProfilePresenter.toHTTP(result.value.profile) }
  }
}
