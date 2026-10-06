import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { SessionsRepository } from '@/domain/accounts/applications/repositories/sessions-repository'
import { Session } from '@/domain/accounts/entities/session'

export class InMemorySessionsRepository implements SessionsRepository {
  public items: Session[] = []

  async findByTokenHash(tokenHash: string) {
    return this.items.find((item) => item.tokenHash === tokenHash) ?? null
  }

  async create(session: Session) {
    this.items.push(session)
  }

  async save(session: Session) {
    const index = this.items.findIndex((item) => item.id.equals(session.id))

    this.items[index] = session
  }

  async revokeAllByUserId(userId: UniqueEntityId, now: Date) {
    this.items
      .filter((item) => item.userId.equals(userId))
      .forEach((item) => item.revoke(now))
  }
}
