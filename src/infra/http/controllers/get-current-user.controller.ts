import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
} from '@nestjs/common'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { GetCurrentUserUseCase } from '@/domain/accounts/applications/use-cases/get-current-user'
import { CurrentUser } from '@/infra/auth/current-user-decorator'
import { UserPayload } from '@/infra/auth/jwt-strategy'
import { UserPresenter } from '../presenters/user-presenter'

/** UC-05 — GET /me */
@Controller('me')
export class GetCurrentUserController {
  constructor(private getCurrentUser: GetCurrentUserUseCase) {}

  @Get()
  async handle(@CurrentUser() user: UserPayload) {
    const result = await this.getCurrentUser.execute({ userId: user.sub })

    if (result.isLeft()) {
      const error = result.value

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message)
        default:
          throw new BadRequestException(error.message)
      }
    }

    return { user: UserPresenter.toHTTP(result.value.user) }
  }
}
