import { Either, right } from '@/core/either'
import { RefreshTokenGenerator } from '../cryptography/refresh-token-generator'
import { SessionsRepository } from '../repositories/sessions-repository'

interface LogoutUseCaseRequest {
  refreshToken: string
}

type LogoutUseCaseResponse = Either<never, null>

/**
 * UC-04 — ver docs/08-casos-de-uso.md#uc-04--logout
 * Idempotente: sessão inexistente ou já revogada também é sucesso.
 */
export class LogoutUseCase {
  constructor(
    private sessionsRepository: SessionsRepository,
    private refreshTokenGenerator: RefreshTokenGenerator
  ) {}

  async execute({
    refreshToken,
  }: LogoutUseCaseRequest): Promise<LogoutUseCaseResponse> {
    const session = await this.sessionsRepository.findByTokenHash(
      this.refreshTokenGenerator.hash(refreshToken)
    )

    if (session && !session.isRevoked) {
      session.revoke()
      await this.sessionsRepository.save(session)
    }

    return right(null)
  }
}
