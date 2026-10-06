import { Either, left, right } from '@/core/either'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { User } from '../../entities/user'
import { UsersRepository } from '../repositories/users-repository'

interface GetCurrentUserUseCaseRequest {
  userId: string
}

type GetCurrentUserUseCaseResponse = Either<
  ResourceNotFoundError,
  { user: User }
>

/**
 * UC-05 — ver docs/08-casos-de-uso.md#uc-05--getcurrentuser
 * Devolve a entidade inteira; o presenter do controller remove o passwordHash.
 */
export class GetCurrentUserUseCase {
  constructor(private usersRepository: UsersRepository) {}

  async execute({
    userId,
  }: GetCurrentUserUseCaseRequest): Promise<GetCurrentUserUseCaseResponse> {
    const user = await this.usersRepository.findById(userId)

    // Usuário apagado com access token ainda válido (até 15 min).
    if (!user) {
      return left(new ResourceNotFoundError('User'))
    }

    return right({ user })
  }
}
