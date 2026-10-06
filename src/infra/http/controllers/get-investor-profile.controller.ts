import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
} from '@nestjs/common'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { GetInvestorProfileUseCase } from '@/domain/portfolio/applications/use-cases/get-investor-profile'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { InvestorProfilePresenter } from '../presenters/investor-profile-presenter'

/** UC-07 — GET /investor-profile */
@Controller('investor-profile')
export class GetInvestorProfileController {
  constructor(private getInvestorProfile: GetInvestorProfileUseCase) {}

  @Get()
  async handle(@CurrentUser() user: UserPayload) {
    const result = await this.getInvestorProfile.execute({ userId: user.sub })

    if (result.isLeft()) {
      const error = result.value

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message)
        default:
          throw new BadRequestException(error.message)
      }
    }

    return {
      profile: InvestorProfilePresenter.toHTTP(result.value.profile),
      isOutdated: result.value.isOutdated,
    }
  }
}
