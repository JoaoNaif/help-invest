import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { z } from 'zod'
import { ResourceAlreadyExistsError } from '@/core/errors/err/resource-already-exists-error'
import { RegisterUserUseCase } from '@/domain/accounts/applications/use-cases/register-user'
import { Public } from '@/infra/auth/public'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { UserPresenter } from '../presenters/user-presenter'

const registerUserBodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  // bcrypt ignora o que passa de 72 bytes
  password: z.string().min(8).max(72),
})

type RegisterUserBodySchema = z.infer<typeof registerUserBodySchema>

/** UC-01 — POST /accounts */
@Controller('accounts')
@Public()
export class RegisterUserController {
  constructor(private registerUser: RegisterUserUseCase) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async handle(
    @Body(new ZodValidationPipe(registerUserBodySchema))
    body: RegisterUserBodySchema
  ) {
    const result = await this.registerUser.execute(body)

    if (result.isLeft()) {
      const error = result.value

      switch (error.constructor) {
        case ResourceAlreadyExistsError:
          throw new ConflictException(error.message)
        default:
          throw new BadRequestException(error.message)
      }
    }

    return { user: UserPresenter.toHTTP(result.value.user) }
  }
}
