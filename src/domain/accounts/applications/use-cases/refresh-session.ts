import { Either, left, right } from '@/core/either'
import { Session } from '../../entities/session'
import { Encrypter } from '../cryptography/encrypter'
import { RefreshTokenGenerator } from '../cryptography/refresh-token-generator'
import { InvalidSessionError } from '../errors/invalid-session-error'
import { SessionsRepository } from '../repositories/sessions-repository'

interface RefreshSessionUseCaseRequest {
  refreshToken: string
  userAgent?: string | null
}

type RefreshSessionUseCaseResponse = Either<
  InvalidSessionError,
  { accessToken: string; refreshToken: string }
>

/** UC-03 — ver docs/08-casos-de-uso.md#uc-03--refreshsession */
export class RefreshSessionUseCase {
  constructor(
    private sessionsRepository: SessionsRepository,
    private encrypter: Encrypter,
    private refreshTokenGenerator: RefreshTokenGenerator
  ) {}

  async execute({
    refreshToken,
    userAgent,
  }: RefreshSessionUseCaseRequest): Promise<RefreshSessionUseCaseResponse> {
    const now = new Date()

    const session = await this.sessionsRepository.findByTokenHash(
      this.refreshTokenGenerator.hash(refreshToken)
    )

    if (!session) {
      return left(new InvalidSessionError())
    }

    // Token já usado apareceu de novo: alguém o copiou. Derruba tudo.
    if (session.isRevoked) {
      await this.sessionsRepository.revokeAllByUserId(session.userId, now)

      return left(new InvalidSessionError())
    }

    if (session.isExpired(now)) {
      return left(new InvalidSessionError())
    }

    // Rotação: o token atual deixa de valer e um par novo é emitido.
    session.revoke(now)
    await this.sessionsRepository.save(session)

    const accessToken = await this.encrypter.encrypt({
      sub: session.userId.toString(),
    })

    const newRefreshToken = this.refreshTokenGenerator.generate()

    const newSession = Session.create({
      userId: session.userId,
      tokenHash: this.refreshTokenGenerator.hash(newRefreshToken),
      expiresAt: Session.expiresAtFrom(now),
      userAgent: userAgent ?? session.userAgent,
    })

    await this.sessionsRepository.create(newSession)

    return right({ accessToken, refreshToken: newRefreshToken })
  }
}
