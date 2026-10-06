import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Session } from '../../entities/session'

export abstract class SessionsRepository {
  abstract findByTokenHash(tokenHash: string): Promise<Session | null>
  abstract create(session: Session): Promise<void>
  abstract save(session: Session): Promise<void>
  /** Revoga todas as sessões ainda não revogadas do usuário. */
  abstract revokeAllByUserId(userId: UniqueEntityId, now: Date): Promise<void>
}
