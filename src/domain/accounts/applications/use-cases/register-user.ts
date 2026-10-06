import { Either, left, right } from '@/core/either'
import { ResourceAlreadyExistsError } from '@/core/errors/err/resource-already-exists-error'
import { User } from '../../entities/user'
import { HashGenerator } from '../cryptography/hash-generator'
import { UsersRepository } from '../repositories/users-repository'

interface RegisterUserUseCaseRequest {
  name: string
  email: string
  password: string
}

type RegisterUserUseCaseResponse = Either<
  ResourceAlreadyExistsError,
  { user: User }
>

/** UC-01 — ver docs/08-casos-de-uso.md#uc-01--registeruser */
export class RegisterUserUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private hashGenerator: HashGenerator
  ) {}

  async execute({
    name,
    email,
    password,
  }: RegisterUserUseCaseRequest): Promise<RegisterUserUseCaseResponse> {
    const normalizedEmail = User.normalizeEmail(email)

    const userWithSameEmail =
      await this.usersRepository.findByEmail(normalizedEmail)

    if (userWithSameEmail) {
      return left(new ResourceAlreadyExistsError('User'))
    }

    const passwordHash = await this.hashGenerator.hash(password)

    const user = User.create({ name, email: normalizedEmail, passwordHash })

    await this.usersRepository.create(user)

    return right({ user })
  }
}
