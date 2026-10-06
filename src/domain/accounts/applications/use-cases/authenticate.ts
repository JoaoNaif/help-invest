import { Either, left, right } from '@/core/either'
import { Session } from '../../entities/session'
import { User } from '../../entities/user'
import { Encrypter } from '../cryptography/encrypter'
import { HashCompare } from '../cryptography/hash-compare'
import { RefreshTokenGenerator } from '../cryptography/refresh-token-generator'
import { WrongCredentialsError } from '../errors/wrong-credentials-error'
import { SessionsRepository } from '../repositories/sessions-repository'
import { UsersRepository } from '../repositories/users-repository'

interface AuthenticateUseCaseRequest {
  email: string
  password: string
  userAgent?: string | null
}

type AuthenticateUseCaseResponse = Either<
  WrongCredentialsError,
  { accessToken: string; refreshToken: string }
>

/** UC-02 — ver docs/08-casos-de-uso.md#uc-02--authenticate */
export class AuthenticateUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private sessionsRepository: SessionsRepository,
    private hashCompare: HashCompare,
    private encrypter: Encrypter,
    private refreshTokenGenerator: RefreshTokenGenerator
  ) {}

  async execute({
    email,
    password,
    userAgent,
  }: AuthenticateUseCaseRequest): Promise<AuthenticateUseCaseResponse> {
    const user = await this.usersRepository.findByEmail(
      User.normalizeEmail(email)
    )

    // Mesmo erro para e-mail e senha: não revela se o e-mail existe.
    if (!user) {
      return left(new WrongCredentialsError())
    }

    const isPasswordValid = await this.hashCompare.compare(
      password,
      user.passwordHash
    )

    if (!isPasswordValid) {
      return left(new WrongCredentialsError())
    }

    const accessToken = await this.encrypter.encrypt({
      sub: user.id.toString(),
    })

    // O token puro só existe na resposta; no banco fica apenas o hash.
    const refreshToken = this.refreshTokenGenerator.generate()

    const session = Session.create({
      userId: user.id,
      tokenHash: this.refreshTokenGenerator.hash(refreshToken),
      expiresAt: Session.expiresAtFrom(new Date()),
      userAgent,
    })

    await this.sessionsRepository.create(session)

    return right({ accessToken, refreshToken })
  }
}
